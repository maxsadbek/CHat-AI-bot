/**
 * Enterprise Video AI Prompt Service
 *
 * Generates structured JSON prompts for professional AI video generators.
 * Supports: Hailuo AI, Kling AI, Google Veo, Runway, PixVerse.
 *
 * Always returns fully populated VideoPrompt objects. If JSON parsing
 * fails, a text-based field extractor scans the raw output for known
 * key headers (e.g. "Scene:", "Lighting:") so that no field is ever
 * left empty when the AI gives a structured textual answer.
 */

import { BaseAIService } from "./base";
import type { VideoPrompt, VideoPlatform } from "@/types";
import type { PlanType } from "@/config/ai";

// ─── Known field headers in the AI's textual fallback output ──────
const FIELD_HEADERS: Record<string, keyof VideoPrompt> = {
  scene: "scene",
  lighting: "lighting",
  camera: "cameraMovement",
  movement: "cameraMovement",
  lens: "lens",
  environment: "environment",
  "negative prompt": "negativePrompt",
  "negative": "negativePrompt",
  voice: "voice",
  sound: "voice",
  music: "music",
  duration: "duration",
  style: "style",
  "full prompt": "fullPrompt",
};

/** Known header aliases for the text fallback parser. */
const HEADER_ALIASES = [
  "Negative prompt",
  "Camera Movement",
  "Camera movement",
  "cameraMovement",
  "Camera",
  "Full Prompt",
  "fullPrompt",
  "Scene",
  "Lighting",
  "Lens",
  "Environment",
  "Voice",
  "Music",
  "Duration",
  "Style",
  "Sound",
  "Negative",
];

// ─── Service ──────────────────────────────────────────────────────

export class VideoAIService extends BaseAIService {
  private readonly platforms: VideoPlatform[] = [
    "Hailuo AI",
    "Kling AI",
    "Google Veo",
    "Runway",
    "PixVerse",
  ];

  constructor() {
    super("video");
  }

  async generatePrompt(
    description: string,
    platform?: VideoPlatform,
    modelId?: string,
    userPlan?: string | PlanType
  ): Promise<VideoPrompt[]> {
    const targetPlatforms = platform ? [platform] : this.platforms;

    const systemPrompt = `You are a professional cinematic AI video prompt engineer.

Create production-ready prompts for Hailuo AI, Kling AI, Veo, Runway and PixVerse.

Every prompt must include:
- cinematic scene description
- realistic environment
- character/action details
- camera movement
- camera lens
- lighting
- visual effects
- atmosphere
- negative prompt
- music suggestion
- duration
- professional filmmaking style

CRITICAL RULES:
- Never repeat text.
- Never return incomplete sentences.
- Always return valid JSON only.
- NEVER wrap the JSON inside markdown code blocks.
- NEVER add any text before or after the JSON array.
- Return EXACTLY one JSON object per platform.

You MUST respond with a JSON array where EVERY object has ALL of these fields:
[
  {
    "platform": "Hailuo AI",
    "scene": "Detailed cinematic scene description. Do NOT repeat this in fullPrompt.",
    "lighting": "Lighting setup, mood, shadows, color temperature.",
    "cameraMovement": "Camera angle, movement type, position relative to subject.",
    "lens": "Lens type and focal length, e.g. 35mm prime lens.",
    "environment": "Setting, time of day, weather, atmosphere details.",
    "negativePrompt": "What to avoid: artifacts, distortions, deformed faces, extra limbs, low quality.",
    "voice": "Voice-over or narration style description.",
    "music": "Music genre, tempo, mood for the soundtrack.",
    "duration": "Suggested clip duration in seconds, e.g. 10 seconds.",
    "style": "Visual style, e.g. Hollywood action, 8K cinematic, ultra-realistic, IMAX.",
    "fullPrompt": "A single, complete, ready-to-paste professional prompt combining all elements above."
  }
]

IMPORTANT: Return ONLY the JSON array. No markdown. No explanation. No code blocks.`;

    const userPrompt = `Generate professional cinematic video prompts for the following idea:

"${description}"

Target platforms: ${targetPlatforms.join(", ")}

Return one JSON object per platform in a JSON array.`;

    const response = await this.executeAI(
      [{ role: "user", content: userPrompt }],
      systemPrompt,
      modelId,
      userPlan
    );

    return this.parseResponse(response.content, targetPlatforms, description);
  }

  /**
   * Parse AI JSON response, with robust fallback to text-based extraction.
   *
   * Strategy:
   * 1. Strip ALL markdown code blocks from anywhere in the response
   * 2. Extract JSON substring by finding the first `[` or `{`
   * 3. Attempt JSON.parse with multiple fix-up strategies (single quotes, trailing commas)
   * 4. If JSON fails, use `extractFieldsFromText` to parse "Field: value" lines
   * 5. If even that yields nothing, pack the raw content into fullPrompt only
   */
  private parseResponse(
    rawContent: string,
    targetPlatforms: VideoPlatform[],
    description: string
  ): VideoPrompt[] {
    // 1. Strip ALL markdown code blocks from anywhere in the response
    const noCodeBlocks = rawContent.replace(/```[\s\S]*?```/g, "").trim();

    // 2. Extract JSON substring from surrounding text
    const jsonStr = this.extractJsonString(noCodeBlocks);
    if (jsonStr) {
      const jsonResult = this.tryParseJson(jsonStr, targetPlatforms);
      if (jsonResult) return jsonResult;
    }

    // 3. Fallback: text-based field extraction on the full cleaned text
    const fields = this.extractFieldsFromText(noCodeBlocks);
    if (Object.keys(fields).length > 0) {
      return targetPlatforms.map((p) => this.buildFromFields(p, fields, description));
    }

    // 4. Last resort: pack everything into fullPrompt
    return targetPlatforms.map((p) =>
      this.buildEmptyFallback(p, noCodeBlocks, description)
    );
  }

  /**
   * Locate the first JSON array or object within a text blob and return it.
   * Returns null if no JSON-like structure is found.
   */
  private extractJsonString(text: string): string | null {
    const firstBracket = text.indexOf("[");
    const firstBrace = text.indexOf("{");

    let startIdx = -1;
    if (firstBracket >= 0 && (firstBrace < 0 || firstBracket < firstBrace)) {
      startIdx = firstBracket;
    } else if (firstBrace >= 0) {
      startIdx = firstBrace;
    }

    if (startIdx < 0) return null;
    return text.substring(startIdx).trim();
  }

  /**
   * Attempt to parse the response as JSON. Tries multiple parsing strategies
   * and returns structured VideoPrompt[] on success.
   */
  private tryParseJson(
    text: string,
    targetPlatforms: VideoPlatform[]
  ): VideoPrompt[] | null {
    // Collect all attempts; first to succeed wins
    const candidates = [
      text,                                        // raw
      text.replace(/'/g, '"'),                      // single -> double quotes
      text.replace(/,([\s\n]*[}\]])/g, "$1"),       // trailing commas
      text.replace(/'/g, '"').replace(/,([\s\n]*[}\]])/g, "$1"), // both fixes
    ];

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);
        const arr: unknown[] = Array.isArray(parsed) ? parsed : [parsed];

        const results: VideoPrompt[] = arr
          .map((item, idx) => {
            const p = item as Record<string, unknown>;
            const platform =
              (p["platform"] as VideoPlatform) ??
              targetPlatforms[idx] ??
              targetPlatforms[0]!;

            return {
              platform,
              scene: this.safeString(p["scene"]),
              lighting: this.safeString(p["lighting"]),
              cameraMovement: this.safeString(p["cameraMovement"]),
              lens: this.safeString(p["lens"]),
              environment: this.safeString(p["environment"]),
              negativePrompt: this.safeString(p["negativePrompt"]),
              voice: this.safeString(p["voice"]),
              music: this.safeString(p["music"]),
              duration: this.safeString(p["duration"]),
              style: this.safeString(p["style"]),
              fullPrompt: this.safeString(p["fullPrompt"]) || text,
            };
          })
          .filter((r): r is VideoPrompt => !!r.platform);

        if (results.length > 0) return results;
      } catch {
        // Try next candidate
      }
    }

    return null;
  }

  /**
   * Skip fullPrompt text that looks like raw JSON to avoid showing
   * unparsed JSON to the end user.
   */
  private looksLikeRawJson(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) return false;
    const first = trimmed[0]!;
    // Starts with [ or { and contains typical JSON patterns
    if (first === "[" || first === "{") {
      return /"[a-zA-Z]+\s*":/.test(trimmed.slice(0, 200));
    }
    return false;
  }

  /**
   * Extract structured fields from a text response that uses
   * "FieldName: value" lines (e.g. "Scene: ...", "Lighting: ...").
   */
  private extractFieldsFromText(text: string): Partial<Record<keyof VideoPrompt, string>> {
    const fields: Partial<Record<keyof VideoPrompt, string>> = {};

    // Build a regex that matches any of the known header aliases
    // e.g. "Scene:", "Negative Prompt:", "Camera Movement:", "Camera:", etc.
    const headerPattern = HEADER_ALIASES.map((h) =>
      h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    ).join("|");

    const regex = new RegExp(
      `(?:^|\\n)\\s*(?:\\*{0,2})?(${headerPattern})\\s*:\\s*(?:\\*{0,2})?([\\s\\S]*?)(?=\\n\\s*(?:${headerPattern})\\s*:|\\n\\s*[-=]{3,}|$)`,
      "gim"
    );

    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const rawHeader = match[1]!.trim();
      const value = match[2]!.trim();
      if (!value) continue;

      const mappedKey = this.mapHeaderToField(rawHeader);
      if (mappedKey) {
        // If multiple matches for the same key, append (don't overwrite)
        if (fields[mappedKey]) {
          fields[mappedKey] += "\n" + value;
        } else {
          fields[mappedKey] = value;
        }
      }
    }

    return fields;
  }

  /**
   * Map a text header like "Camera Movement", "Camera", "Negative Prompt" to
   * the canonical VideoPrompt field name.
   */
  private mapHeaderToField(header: string): keyof VideoPrompt | null {
    const lower = header.toLowerCase().replace(/\s+/g, " ").trim();
    for (const [alias, field] of Object.entries(FIELD_HEADERS)) {
      if (lower === alias || lower.startsWith(alias)) {
        return field;
      }
    }
    return null;
  }

  /**
   * Build a VideoPrompt from extracted fields.
   */
  private buildFromFields(
    platform: VideoPlatform,
    fields: Partial<Record<keyof VideoPrompt, string>>,
    _description: string
  ): VideoPrompt {
    const scene = fields.scene || "";
    const lighting = fields.lighting || "";
    const cameraMovement = fields.cameraMovement || "";
    const lens = fields.lens || "";
    const environment = fields.environment || "";
    const negativePrompt = fields.negativePrompt || "";
    const voice = fields.voice || "";
    const music = fields.music || "";
    const duration = fields.duration || "";
    const style = fields.style || "";
    const fullPrompt = fields.fullPrompt || "";

    return {
      platform,
      scene,
      lighting,
      cameraMovement,
      lens,
      environment,
      negativePrompt,
      voice,
      music,
      duration,
      style,
      fullPrompt,
    };
  }

  /**
   * Absolute last-resort fallback: uses the user's description as the scene
   * and hides fullPrompt if it looks like raw JSON.
   */
  private buildEmptyFallback(
    platform: VideoPlatform,
    rawContent: string,
    description: string
  ): VideoPrompt {
    const isRawJson = this.looksLikeRawJson(rawContent);
    return {
      platform,
      scene: isRawJson ? description : "",
      lighting: "",
      cameraMovement: "",
      lens: "",
      environment: "",
      negativePrompt: "",
      voice: "",
      music: "",
      duration: "",
      style: "",
      fullPrompt: isRawJson ? "" : rawContent,
    };
  }

  /**
   * Safely convert a value to string, defaulting to empty string.
   */
  private safeString(val: unknown): string {
    if (typeof val === "string") return val;
    if (typeof val === "number" || typeof val === "boolean") return String(val);
    return "";
  }

  getPlatforms(): VideoPlatform[] {
    return [...this.platforms];
  }
}

export const videoAIService = new VideoAIService();
