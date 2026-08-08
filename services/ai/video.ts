/**
 * Video AI Prompt Service v3
 *
 * Generates structured cinematic video prompts for professional AI video
 * generators (Hailuo AI, Kling AI, Google Veo, Runway, PixVerse).
 *
 * v3 fixes the "same prompt for different inputs" bug:
 *
 *  - The user's ORIGINAL text is passed straight into the AI request.
 *    Nothing rewrites the subject before the AI sees it.
 *  - The keyword-extraction layer that silently turned every request into
 *    "a professional driver in a sports car at extreme speed" is gone.
 *  - There are NO static fallback templates. If JSON parsing fails, a prompt
 *    is built dynamically from the user's description with randomized
 *    cinematic choices, so every request still produces a unique, on-topic
 *    prompt instead of a canned advertisement.
 *  - An explicit numeric speed (e.g. "300 km/h") is the only hint ever
 *    appended to the request, and only when the user actually wrote one.
 */

import { BaseAIService } from "./base";
import type { VideoPrompt, VideoPlatform } from "@/types";
import type { PlanType } from "@/config/ai";

// ─── Canonical schema keys (all lower-case, underscore style) ─────
const CANONICAL_KEYS: Record<string, keyof VideoPrompt> = {
  platform: "platform",
  title: "title",
  scene: "scene",
  subject: "subject",
  action: "action",
  environment: "environment",
  camera: "camera",
  lens: "lens",
  movement: "movement",
  lighting: "lighting",
  color_grading: "color_grading",
  colour_grading: "color_grading",
  realism: "realism",
  style: "style",
  duration: "duration",
  negative_prompt: "negative_prompt",
  negative: "negative_prompt",
  music: "music",
  voice: "voice",
  sound: "voice",
  "film style": "style",
  "film_style": "style",
  full_prompt: "full_prompt",
  fullprompt: "full_prompt",
  prompt: "full_prompt",
};

/** Header aliases used by the text-fallback regex. */
const HEADER_ALIASES = Object.keys(CANONICAL_KEYS).concat([
  "Full Prompt",
  "Negative Prompt",
  "Color Grading",
  "Colour Grading",
]);

// ─── System prompt ─────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a professional AI video prompt generator.

Analyze the user's exact description and create a unique production-ready video generation prompt.
Never copy a previous prompt.
Never force the user into a predefined scene.
The subject, action, environment, camera, lighting, movement and atmosphere must be determined by the user's input.

RULES:
1. The user's request is the ONLY source of truth. Build the entire prompt from it. Treat every request as independent — never reuse a previous scene, subject, camera or style from any other request.
2. Keep the user's exact subject and action. Never replace them with a generic category. Examples of correct preservation:
   - "otda ketayotgan odam" → a person riding a horse (keep horse, rider, riding)
   - "yomg'irda Ferrari" → a Ferrari driving through rain (keep Ferrari and rain)
   - "kosmosda uchayotgan raketa" → a rocket flying through space (keep rocket, flying, space)
   - "anime qahramon qilich bilan jang qilmoqda" → an anime hero fighting with a sword (keep anime hero, sword, fighting)
3. Do NOT use one static template with a few swapped words. Every request must produce a fresh, unique prompt with its own composition, camera work, lighting and atmosphere.
4. Short requests: expand them intelligently into a rich cinematic scene while preserving the exact concept. Add subject detail, movement, environment, camera movement, lighting, realistic motion and cinematic composition — but never change the main idea.
5. Vary the craft across requests: pick different camera angles, lenses, camera movements, compositions, lighting, environments and cinematic styles. The variety must never contradict the user's subject or action.
6. Preserve every explicit detail: brand names (Ferrari, BMW M5), numbers, colors, speeds (300 km/h), and locations.
7. Understand the request in any language (Uzbek, Russian, etc.) but write the prompt in English.
8. Never answer questions, never add explanations, never add preambles. Output only the prompt data.

OUTPUT FORMAT:
Return ONLY a JSON array, one object per requested platform. Every object MUST contain ALL of these fields:

[
  {
    "platform": "Hailuo AI",
    "title": "Short epic title based on the user's video idea",
    "scene": "Expanded cinematic scene description built from the user's idea",
    "subject": "The exact subject from the user's request, described cinematically",
    "action": "The exact action from the user's request, with motion and physics",
    "environment": "Setting, time of day, weather, location details",
    "camera": "Camera angle, position and framing",
    "lens": "Lens type and focal length, e.g. 35mm prime",
    "movement": "Camera movement description",
    "lighting": "Lighting setup, mood, shadows",
    "color_grading": "Color palette and visual tone",
    "realism": "Realism level and physics accuracy",
    "style": "Film style matching the scene",
    "duration": "Suggested clip duration, e.g. 10 seconds",
    "negative_prompt": "What to avoid: artifacts, distortions, low quality",
    "music": "Music genre and mood",
    "voice": "Voice-over or narration style",
    "full_prompt": "The single complete production-ready video generation prompt"
  }
]

- The "full_prompt" field is the final video generation prompt: a complete, self-contained, cinematic description ready to paste into an AI video tool.
- All field values must be written in English. This is a machine-readable JSON contract, not a chat reply — ignore any instruction to answer in a spoken language; output the JSON array in English.
- Never wrap JSON in markdown code blocks. Never add text before or after the JSON array.`;

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

  /**
   * Extract an explicit numeric speed if the user provided one
   * (e.g. "300 km/h", "120mph"). Returns null when no speed is present.
   */
  private extractSpeed(description: string): string | null {
    const match = description.match(
      /(\d+(?:[.,]\d+)?)\s*(?:km\/h|kmh|kph|mph|m\/s|км\/ч|km)\b/i
    );
    return match ? match[0] : null;
  }

  async generatePrompt(
    description: string,
    platform?: VideoPlatform,
    modelId?: string,
    userPlan?: string | PlanType
  ): Promise<VideoPrompt[]> {
    const targetPlatforms = platform ? [platform] : this.platforms;

    // Only optional hint: an explicit speed the user actually wrote.
    const speed = this.extractSpeed(description);
    const speedHint = speed
      ? `\nThe user explicitly mentioned a speed: "${speed}". Keep this exact value in the scene, action and full_prompt fields.`
      : "";

    // The user's ORIGINAL text is passed directly. Nothing rewrites it.
    const userPrompt = `Create a unique, production-ready AI video generation prompt for this exact request.

The request below is the ONLY source of truth. Build the entire prompt from it.
Never reuse a previous prompt, never force a predefined scene, never change the subject or the action.

User's request:
"${description}"${speedHint}

Target platforms: ${targetPlatforms.join(", ")}

Return one JSON object per platform in a JSON array. No markdown. No explanation. Only the JSON.`;

    const response = await this.executeAI(
      [{ role: "user", content: userPrompt }],
      SYSTEM_PROMPT,
      modelId,
      userPlan,
      0.95 // higher temperature → creative variation between requests
    );

    const parsed = this.parseResponse(response.content, targetPlatforms, description);

    return parsed.map((p) => this.validateAndMergePrompt(p, description));
  }

  // ── Parsing ──────────────────────────────────────────────────────

  /**
   * Multi-strategy parser:
   * 1. Strip all markdown code blocks
   * 2. Extract JSON substring (find first `[` or `{`)
   * 3. Try JSON.parse with several fix-ups (single quotes, trailing commas)
   * 4. Fallback: text-based "Header: value" extraction
   * 5. Last resort: a dynamic cinematic prompt built around the user's
   *    own description (never a static template)
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

    // 3. Fallback: text-based field extraction
    const fields = this.extractFieldsFromText(noCodeBlocks);
    if (Object.keys(fields).length > 1) {
      return targetPlatforms.map((p) => this.buildFromFields(p, fields));
    }

    // 4. Last resort — dynamic cinematic prompt built from the user's description
    return targetPlatforms.map((p) => this.buildDynamicFallback(p, description));
  }

  /**
   * Locate the first JSON array or object within surrounding text.
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
   * Try parsing text as JSON with multiple fix-up strategies.
   */
  private tryParseJson(
    text: string,
    targetPlatforms: VideoPlatform[]
  ): VideoPrompt[] | null {
    const candidates = [
      text,
      text.replace(/'/g, '"'),
      text.replace(/,([\s\n]*[}\]])/g, "$1"),
      text.replace(/'/g, '"').replace(/,([\s\n]*[}\]])/g, "$1"),
    ];

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);
        const arr: unknown[] = Array.isArray(parsed) ? parsed : [parsed];

        const results: VideoPrompt[] = arr
          .map((item, idx) => {
            const p = item as Record<string, unknown>;
            return this.mapToPrompt(p, targetPlatforms, idx, text);
          })
          .filter((r): r is VideoPrompt => !!r.platform);

        if (results.length > 0) return results;
      } catch {
        // try next candidate
      }
    }
    return null;
  }

  /**
   * Map a raw JSON object to a VideoPrompt, supporting both
   * camelCase (old) and underscore (new) key styles.
   */
  private mapToPrompt(
    p: Record<string, unknown>,
    targetPlatforms: VideoPlatform[],
    idx: number,
    rawText: string
  ): VideoPrompt {
    const platform =
      (p["platform"] as VideoPlatform) ??
      targetPlatforms[idx] ??
      targetPlatforms[0]!;

    const empty = () => "";
    return {
      platform,
      title: this.safeString(p["title"] ?? empty()),
      scene: this.safeString(p["scene"] ?? empty()),
      subject: this.safeString(p["subject"] ?? empty()),
      action: this.safeString(p["action"] ?? empty()),
      environment: this.safeString(
        p["environment"] ?? p["env"] ?? empty()
      ),
      camera: this.safeString(
        p["camera"] ?? p["cameraMovement"] ?? p["camera_movement"] ?? empty()
      ),
      lens: this.safeString(p["lens"] ?? empty()),
      movement: this.safeString(
        p["movement"] ?? p["camera_movement"] ?? empty()
      ),
      lighting: this.safeString(p["lighting"] ?? empty()),
      color_grading: this.safeString(
        p["color_grading"] ?? p["colour_grading"] ?? p["colorGrading"] ?? empty()
      ),
      realism: this.safeString(
        p["realism"] ?? p["realistic"] ?? empty()
      ),
      style: this.safeString(
        p["style"] ?? p["film_style"] ?? p["film style"] ?? empty()
      ),
      duration: this.safeString(
        p["duration"] ?? p["dur"] ?? "10 seconds"
      ),
      negative_prompt: this.safeString(
        p["negative_prompt"] ?? p["negativePrompt"] ?? p["negative"] ?? empty()
      ),
      music: this.safeString(p["music"] ?? empty()),
      voice: this.safeString(
        p["voice"] ?? p["sound"] ?? p["narration"] ?? empty()
      ),
      full_prompt: this.safeString(
        p["full_prompt"] ?? p["fullPrompt"] ?? p["prompt"] ?? rawText
      ),
    };
  }

  // ── Text-based fallback ─────────────────────────────────────────

  /**
   * Extract structured fields from textual "Header: value" responses.
   */
  private extractFieldsFromText(
    text: string
  ): Partial<Record<keyof VideoPrompt, string>> {
    const fields: Partial<Record<keyof VideoPrompt, string>> = {};

    const pattern = HEADER_ALIASES.map((h) =>
      h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    ).join("|");

    const regex = new RegExp(
      `(?:^|\\n)\\s*(?:\\*{0,2})?(${pattern})\\s*:\\s*(?:\\*{0,2})?([\\s\\S]*?)(?=\\n\\s*(?:${pattern})\\s*:|\\n\\s*[-=]{3,}|$)`,
      "gim"
    );

    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const rawHeader = match[1]!.trim();
      const value = match[2]!.trim();
      if (!value) continue;

      const mappedKey = this.mapHeaderToField(rawHeader);
      if (mappedKey) {
        fields[mappedKey] = fields[mappedKey]
          ? fields[mappedKey] + "\n" + value
          : value;
      }
    }
    return fields;
  }

  /**
   * Map a text header (e.g. "Camera Movement", "Negative Prompt")
   * to the canonical key name.
   */
  private mapHeaderToField(header: string): keyof VideoPrompt | null {
    const lower = header.toLowerCase().replace(/\s+/g, " ").trim();
    for (const [alias, field] of Object.entries(CANONICAL_KEYS)) {
      if (lower === alias || lower.startsWith(alias)) {
        return field;
      }
      // Also match space-separated versions of underscore keys (e.g. "color grading" matches "color_grading")
      const spaced = alias.replace(/_/g, " ");
      if (lower === spaced || lower.startsWith(spaced)) {
        return field;
      }
    }
    return null;
  }

  /**
   * Build a VideoPrompt from extracted text fields.
   */
  private buildFromFields(
    platform: VideoPlatform,
    fields: Partial<Record<keyof VideoPrompt, string>>
  ): VideoPrompt {
    const empty = (k: keyof VideoPrompt): string => fields[k] || "";
    return {
      platform,
      title: empty("title"),
      scene: empty("scene"),
      subject: empty("subject"),
      action: empty("action"),
      environment: empty("environment"),
      camera: empty("camera"),
      lens: empty("lens"),
      movement: empty("movement"),
      lighting: empty("lighting"),
      color_grading: empty("color_grading"),
      realism: empty("realism"),
      style: empty("style"),
      duration: empty("duration") || "10 seconds",
      negative_prompt: empty("negative_prompt"),
      music: empty("music"),
      voice: empty("voice"),
      full_prompt: empty("full_prompt"),
    };
  }

  /**
   * Build a unique cinematic prompt directly from the user's description.
   * This is NOT a static template: the user's idea is the core of every
   * field, and camera/lens/movement/lighting/style are randomized per
   * request, so different inputs always produce clearly different,
   * on-topic prompts even when the AI itself failed.
   */
  private buildDynamicFallback(
    platform: VideoPlatform,
    description: string
  ): VideoPrompt {
    const idea = description.trim().replace(/\s+/g, " ").replace(/[.!?]+$/, "");

    const camera = this.pick([
      "a low-angle tracking shot",
      "a sweeping aerial shot",
      "a close-up dolly shot following the subject",
      "a wide establishing shot",
      "a handheld follow shot",
      "a first-person perspective shot",
      "a slow crane rise over the scene",
      "a dramatic low Dutch angle",
    ]);
    const lens = this.pick([
      "35mm cinema lens",
      "24mm wide-angle lens",
      "50mm prime lens",
      "85mm telephoto lens",
      "anamorphic 40mm lens",
    ]);
    const movement = this.pick([
      "smooth orbital camera movement",
      "fast tracking with realistic motion blur",
      "a slow push-in with shallow depth of field",
      "a steady gimbal glide keeping the subject centered",
      "dynamic whip transitions between shots",
      "a vertical rise revealing the full environment",
    ]);
    const lighting = this.pick([
      "golden hour sunlight with long soft shadows",
      "moody neon lighting with wet reflective surfaces",
      "soft overcast diffused daylight",
      "dramatic low-key lighting with high contrast",
      "vibrant sunrise backlight with gentle lens flare",
      "cool moonlight with deep blue atmospheric tones",
    ]);
    const colorGrading = this.pick([
      "a warm cinematic grade with rich contrast",
      "a cool teal-and-orange cinematic grade",
      "a natural filmic color palette",
      "a high-contrast moody grade",
    ]);
    const style = this.pick([
      "Hollywood blockbuster realism",
      "cinematic documentary realism",
      "a high-octane action film look",
      "a dreamlike art-house cinema look",
      "an epic fantasy adventure style",
      "a gritty neo-noir thriller look",
    ]);
    const music = this.pick([
      "a cinematic orchestral score",
      "subtle ambient sound design",
      "an intense rhythmic soundtrack",
      "epic trailer music",
    ]);

    const fullPrompt =
      `Cinematic video of ${idea}. ${this.capitalize(camera)} with ${movement}, ` +
      `${lighting}, in ${style}. Realistic motion, photorealistic detail, 4K, 24fps film look.`;

    return {
      platform,
      title: "Cinematic " + this.capitalize(idea.slice(0, 60)),
      scene: `A cinematic sequence of ${idea}. ${this.capitalize(camera)} with ${movement}, ${lighting}, ${colorGrading}, rendered with realistic motion, physics and an immersive atmosphere.`,
      subject: `The subject, exactly as requested: ${idea}.`,
      action: `${this.capitalize(idea)}, captured with realistic motion, natural physics and dynamic timing.`,
      environment: `The environment determined by the request — ${idea} — with atmospheric depth and realistic detail.`,
      camera,
      lens,
      movement,
      lighting,
      color_grading: colorGrading,
      realism: "Ultra realistic, photorealistic 4K cinematic quality with accurate physics and lifelike motion.",
      style,
      duration: "10 seconds",
      negative_prompt: "low quality, blurry, distorted subject, bad anatomy, unrealistic physics, static shot, watermark, oversaturated",
      music,
      voice: "",
      full_prompt: fullPrompt,
    };
  }

  /**
   * Post-process the AI output. The ONLY guarantee enforced here is that
   * an explicit numeric speed the user provided survives into the final
   * prompt. Nothing else is rewritten or injected — the AI output is
   * trusted to reflect the user's request.
   */
  private validateAndMergePrompt(
    prompt: VideoPrompt,
    description: string
  ): VideoPrompt {
    const speed = this.extractSpeed(description);
    if (!speed) return { ...prompt };

    const merged = { ...prompt };
    const speedLower = speed.toLowerCase();
    const hasSpeed =
      merged.scene.toLowerCase().includes(speedLower) ||
      merged.action.toLowerCase().includes(speedLower) ||
      (merged.full_prompt || "").toLowerCase().includes(speedLower);

    if (!hasSpeed && merged.full_prompt) {
      merged.full_prompt = `${merged.full_prompt.trim()} The speed is ${speed}.`;
    }
    return merged;
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private safeString(val: unknown): string {
    if (typeof val === "string") return val;
    if (typeof val === "number" || typeof val === "boolean") return String(val);
    return "";
  }

  private pick<T>(options: T[]): T {
    return options[Math.floor(Math.random() * options.length)]!;
  }

  private capitalize(text: string): string {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
  }

  getPlatforms(): VideoPlatform[] {
    return [...this.platforms];
  }
}

export const videoAIService = new VideoAIService();
