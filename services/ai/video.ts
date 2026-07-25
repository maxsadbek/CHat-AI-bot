/**
 * Enterprise Video AI Prompt Service v2
 *
 * Generates structured cinematic video prompts for professional AI video
 * generators.  Supports Hailuo AI, Kling AI, Google Veo, Runway & PixVerse.
 *
 * The AI is instructed to return ONLY a JSON array with the canonical
 * schema below.  If JSON parsing fails, a text-based field extractor
 * attempts to recover structured fields from "Header: value" lines;
 * otherwise a safe fallback is returned that never leaks raw JSON.
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

const SYSTEM_PROMPT = `You are an expert cinematic AI video prompt creator.

Your job is NOT to repeat the user's sentence.

Expand every simple idea into a professional movie production prompt.

Create prompts for Hailuo AI, Kling AI, Google Veo, Runway and PixVerse.

Include:
- main subject
- detailed action
- realistic physics
- environment
- cinematic camera movement
- camera lens
- lighting
- atmosphere
- motion effects
- realistic details
- film style
- negative prompt

User's main object, action and unique details are mandatory.
Never replace the user's idea with generic cinematic text.
Every generated field must be connected to the original description.

Example:

Input:
Mototsiklda ketayotgan odam moto 300km tezlikda ketayapti

Output:
A cinematic high-speed motorcycle scene on an empty highway. A professional rider wearing a black racing suit controls a superbike moving at extreme speed. The camera follows from a low-angle tracking shot near the wheels, realistic motion blur, wind effects, dramatic sunset lighting, 35mm cinema lens, ultra realistic physics, 4K movie quality.

Never copy the user's sentence directly.

CRITICAL RULES:
- Never repeat text.
- Never return incomplete sentences.
- Return ONLY valid JSON.
- NEVER wrap JSON inside markdown code blocks.
- NEVER add text before or after the JSON array.
- Return EXACTLY one JSON object per platform.
- EVERY field MUST contain generated content that is connected to the user's idea. Do NOT leave fields empty.

You MUST respond with a JSON array where EVERY object has ALL of these fields filled with creative, expanded content that references the user's original idea:

[
  {
    "platform": "Hailuo AI",
    "title": "Short epic title based on the user's video idea",
    "scene": "Full cinematic scene description that includes the user's main subject and action",
    "subject": "The user's main subject described in cinematic detail",
    "action": "The user's described action with motion and physics details",
    "environment": "Setting, time of day, weather, location details matching the user's idea",
    "camera": "Camera angle, position, and framing that captures the user's scene",
    "lens": "Lens type and focal length, e.g. 35mm prime",
    "movement": "Camera movement that enhances the user's action",
    "lighting": "Lighting setup that fits the user's scene mood",
    "color_grading": "Color palette, grade, visual tone matching the atmosphere",
    "realism": "Realism level, physics accuracy for the user's subject",
    "style": "Film style matching the user's scene: action, drama, sci-fi, etc.",
    "duration": "Suggested clip duration, e.g. 10 seconds",
    "negative_prompt": "What to avoid: artifacts, distortions, deformed faces, low quality",
    "music": "Music genre, tempo, mood that fits the user's scene",
    "voice": "Voice-over or narration style",
    "full_prompt": "Single complete cinematic prompt that includes all elements from the user's idea"
  }
]

Return ONLY the JSON array. No markdown. No explanation. No code blocks.`;

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

    const userPrompt = `Generate professional cinematic video prompts for the following idea:

"${description}"

Target platforms: ${targetPlatforms.join(", ")}

Return one JSON object per platform in a JSON array.`;

    const response = await this.executeAI(
      [{ role: "user", content: userPrompt }],
      SYSTEM_PROMPT,
      modelId,
      userPlan
    );

    const parsed = this.parseResponse(response.content, targetPlatforms, description);

    // Validate and merge: ensure AI output contains key elements from user's description
    return parsed.map((p) => this.validateAndMergePrompt(p, description));
  }

  // ── Parsing ──────────────────────────────────────────────────────

  /**
   * Multi-strategy parser:
   * 1. Strip all markdown code blocks
   * 2. Extract JSON substring (find first `[` or `{`)
   * 3. Try JSON.parse with several fix-ups (single quotes, trailing commas)
   * 4. Fallback: text-based "Header: value" extraction
   * 5. Last resort: use user description as scene, never leak raw JSON
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

    // 4. Last resort — dynamic cinematic fallback built around user's description
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
   * Dynamic fallback that weaves the user's description into a cinematic
   * prompt structure.  NEVER returns generic text — every field is built
   * around the user's original idea without copying it verbatim.
   */
  private buildDynamicFallback(
    platform: VideoPlatform,
    description: string
  ): VideoPrompt {
    const desc = description.trim();
    const short = desc.length > 60 ? desc.slice(0, 57) + "..." : desc;

    // Cinematic scene: wrap the user's idea in a professional framing
    const scene = `A cinematic scene featuring ${desc.toLowerCase()}. Professional cinematography captures the action with dramatic lighting, realistic physics, and Hollywood-quality production value.`;

    return {
      platform,
      title: short,
      scene,
      subject: `The main subject of ${short} presented in a cinematic composition with professional detail.`,
      action: `Cinematic action sequence showing ${desc.toLowerCase()} with realistic motion, physics accuracy, and fluid movement.`,
      environment: `Cinematic environment that complements the scene of ${short}, with detailed atmosphere and appropriate setting.`,
      camera: "Dynamic camera angle following the action with professional framing.",
      lens: "35mm cinema lens with cinematic depth of field",
      movement: "Smooth tracking camera movement capturing the speed and motion.",
      lighting: "Dramatic cinematic lighting with realistic shadows and mood enhancement.",
      color_grading: "Cinematic color grade with professional color palette matching the scene mood.",
      realism: "Ultra realistic, 4K cinematic quality with accurate physics and lifelike details.",
      style: "Cinematic film style with professional production quality",
      duration: "10 seconds",
      negative_prompt: "low quality, blurry, distorted objects, unrealistic physics, bad anatomy, cartoon style, deformed features",
      music: "Cinematic soundtrack with dramatic tempo matching the action",
      voice: "Professional cinematic narration",
      full_prompt: scene,
    };
  }

  /**
   * Validate AI-generated prompt against the user's original description.
   * If key content words (nouns, actions) from the user's input are
   * missing from the AI output, append them naturally so the prompt
   * always reflects the user's actual idea.
   */
  private validateAndMergePrompt(
    prompt: VideoPrompt,
    description: string
  ): VideoPrompt {
    const desc = description.toLowerCase();

    const stopWords = new Set([
      "a", "an", "the", "is", "are", "was", "were", "in", "on", "at",
      "to", "for", "of", "with", "and", "or", "but", "not", "it",
      "its", "this", "that", "these", "those", "from", "by", "as",
      "be", "been", "being", "have", "has", "had", "do", "does",
      "did", "will", "would", "can", "could", "should", "may", "might",
      "da", "va", "lar", "ni", "ga", "dan", "bilan", "uchun",
      "bu", "shu", "u", "ular", "men", "sen", "biz", "siz",
    ]);

    const contentWords = desc
      .split(/[\s,.-]+/)
      .map((w) => w.replace(/[^a-z0-9]/g, "").trim())
      .filter((w) => w.length > 2 && !stopWords.has(w));

    // Unique — already in set to avoid duplicates
    const uniqueItems = <T>(a: T[]): T[] => [...new Set(a)];

    // For each target field, collect important words missing from the AI output
    const findMissing = (fieldText: string): string[] => {
      const lower = fieldText.toLowerCase();
      return uniqueItems(
        contentWords.filter((w) => w.length > 2 && !lower.includes(w))
      );
    };

    const missingScene = findMissing(prompt.scene);
    const missingSubject = findMissing(prompt.subject);
    const missingAction = findMissing(prompt.action);
    const missingEnv = findMissing(prompt.environment);

    const merged = { ...prompt };

    // Merge missing details naturally by appending, not awkward prepending
    if (missingScene.length > 0) {
      merged.scene =
        prompt.scene +
        " The scene prominently features " +
        missingScene.slice(0, 5).join(", ") +
        ".";
    }

    if (missingSubject.length > 0) {
      merged.subject =
        prompt.subject +
        " (" +
        missingSubject.slice(0, 3).join(", ") +
        ")";
    }

    if (missingAction.length > 0) {
      merged.action =
        prompt.action +
        " The action includes " +
        missingAction.slice(0, 3).join(", ") +
        ".";
    }

    if (missingEnv.length > 0) {
      merged.environment =
        prompt.environment +
        " The environment features " +
        missingEnv.slice(0, 3).join(", ") +
        ".";
    }

    return merged;
  }

  // ── Helpers ──────────────────────────────────────────────────────

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
