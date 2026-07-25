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

const SYSTEM_PROMPT = `You are a Hollywood professional cinematic AI video prompt engineer.

Your job is to transform user ideas into professional movie prompts.

RULES:
1. NEVER include the user's exact sentence inside output fields.
2. Extract meaning from user text and rewrite it professionally.
3. Replace simple words with cinematic descriptions.
4. Every field must contain specific details related to the user's idea.
5. No generic phrases like "main subject in cinematic setting", "dynamic motion", or "professional composition" unless they include specific details from the user's idea.

Example:

Input:
Mototsiklda ketayotgan odam moto 300km tezlikda ketayapti

Correct output format:
Scene: A breathtaking high-speed motorcycle chase scene on an empty highway. A professional rider accelerates a superbike at extreme 300 km/h speed with realistic wind effects and cinematic action atmosphere.
Subject: A professional rider wearing a black racing suit controlling a powerful superbike.
Action: The motorcycle reaches extreme speed with realistic body movement and physics.

Never copy the user's sentence directly.
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

CRITICAL RULES:
- NEVER include the user's exact sentence in any field.
- Extract the meaning and rewrite it as a professional cinematic description.
- Never repeat text.
- Never return incomplete sentences.
- Return ONLY valid JSON.
- NEVER wrap JSON inside markdown code blocks.
- NEVER add text before or after the JSON array.
- Return EXACTLY one JSON object per platform.
- EVERY field MUST contain generated content connected to the user's idea.

You MUST respond with a JSON array where EVERY object has ALL of these fields:

[
  {
    "platform": "Hailuo AI",
    "title": "Short epic title based on the user's video idea",
    "scene": "Transformed cinematic scene description (never user's exact words)",
    "subject": "Main subject described in cinematic detail",
    "action": "Action with motion and physics details",
    "environment": "Setting, time of day, weather, location details",
    "camera": "Camera angle, position, and framing",
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
    "full_prompt": "Single complete cinematic prompt"
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
   * Detect the general scene type from keywords in the description
   * and return a pre-written cinematic template.  NEVER includes
   * the user's raw text.
   */
  private detectSceneType(description: string): "vehicle" | "nature" | "people" | "action" {
    const lower = description.toLowerCase();
    const vehicleWords = ["moto", "car", "bike", "drive", "speed", "race", "vehicle", "auto", "road", "highway", "truck"];
    const natureWords = ["nature", "landscape", "forest", "mountain", "ocean", "sea", "river", "sky", "sunset", "sunrise", "garden", "park", "field"];
    const peopleWords = ["person", "people", "man", "woman", "child", "human", "character", "actor", "dance", "walk", "run", "fight"];

    if (vehicleWords.some((w) => lower.includes(w))) return "vehicle";
    if (natureWords.some((w) => lower.includes(w))) return "nature";
    if (peopleWords.some((w) => lower.includes(w))) return "people";
    return "action";
  }

  /** Templates keyed by scene type — never contain user text. */
  private readonly fallbackTemplates: Record<string, Omit<VideoPrompt, "platform">> = {
    vehicle: {
      title: "High-Speed Chase",
      scene: "A breathtaking high-speed vehicle scene on an open road. A powerful machine moves at extreme velocity while the camera captures every detail of the motion. Realistic wind effects, tire movement, road vibration, and cinematic action atmosphere create an intense viewing experience.",
      subject: "A professional driver controlling a high-performance vehicle with precision and skill.",
      action: "The vehicle accelerates at extreme speed with realistic physics, wheel rotation, wind resistance, and dynamic body movement.",
      environment: "An open road during golden hour with dramatic sky, atmospheric particles, and realistic lighting conditions.",
      camera: "Low-angle tracking shot following the vehicle, capturing speed and motion from a dynamic perspective.",
      lens: "35mm cinema lens with shallow depth of field",
      movement: "Fast cinematic tracking movement with motion blur and dynamic camera angles.",
      lighting: "Dramatic golden hour lighting with realistic shadows, lens flares, and cinematic contrast.",
      color_grading: "Warm cinematic color grade with high contrast and professional color palette.",
      realism: "Ultra realistic, 4K cinematic quality with accurate physics and lifelike motion details.",
      style: "Hollywood action film style with high-octane energy",
      duration: "10 seconds",
      negative_prompt: "low quality, blurry, distorted objects, unrealistic physics, bad anatomy, cartoon style, deformed features, slow motion, static shot",
      music: "High-energy cinematic soundtrack with intense drum beats and orchestral swells",
      voice: "Deep cinematic voice-over with dramatic tone",
      full_prompt: "",
    },
    nature: {
      title: "Cinematic Landscape",
      scene: "A breathtaking cinematic landscape captured in stunning natural light. The camera glides through the scene revealing majestic views, atmospheric depth, and the raw beauty of the natural world. Realistic environmental effects and immersive sound design create a powerful visual experience.",
      subject: "The natural landscape presented as the main subject with dramatic composition and depth.",
      action: "Slow cinematic revelation of the landscape with natural movement of elements like wind, water, and light.",
      environment: "A pristine natural environment with realistic atmospheric conditions, natural lighting, and immersive details.",
      camera: "Smooth cinematic dolly shot moving through the landscape with professional framing.",
      lens: "Wide-angle cinema lens capturing the full scope of the environment",
      movement: "Slow controlled camera movement revealing the landscape with cinematic grace.",
      lighting: "Natural cinematic lighting using golden hour conditions with soft shadows and warm tones.",
      color_grading: "Natural color grade with enhanced saturation and cinematic warmth.",
      realism: "Ultra realistic, 8K cinematic quality with photorealistic environmental details.",
      style: "Cinematic documentary style with National Geographic quality",
      duration: "15 seconds",
      negative_prompt: "low quality, blurry, artificial look, flat lighting, cartoon style, overexposed, underexposed",
      music: "Ambient cinematic soundtrack with soft orchestral tones and nature sounds",
      voice: "Calm cinematic narration with thoughtful tone",
      full_prompt: "",
    },
    people: {
      title: "Cinematic Portrait",
      scene: "A powerful cinematic scene centered on a compelling character in a dramatic setting. The subject commands attention through expressive movement and emotional presence. Cinematic lighting and professional framing create a visually striking narrative moment.",
      subject: "A compelling character presented with dramatic cinematic lighting and professional portraiture.",
      action: "Expressive character movement with realistic body language, emotional depth, and cinematic timing.",
      environment: "Atmospheric environment that complements the character with mood-appropriate lighting and detail.",
      camera: "Close-up cinematic shot with shallow depth of field focusing on the subject.",
      lens: "85mm prime lens with beautiful bokeh",
      movement: "Subtle cinematic camera movement following the character's motion.",
      lighting: "Dramatic cinematic lighting with Rembrandt-style shadows and professional key light.",
      color_grading: "Cinematic color grade with skin-tone optimization and mood-enhancing palette.",
      realism: "Ultra realistic, 4K cinematic quality with lifelike skin texture and detail.",
      style: "Cinematic drama style with emotional depth",
      duration: "10 seconds",
      negative_prompt: "low quality, blurry, distorted face, bad anatomy, unnatural expression, flat lighting, cartoon style",
      music: "Emotional cinematic soundtrack with piano and strings",
      voice: "Warm cinematic narration with emotional resonance",
      full_prompt: "",
    },
    action: {
      title: "Dynamic Action Scene",
      scene: "An intense cinematic action scene with professional choreography and dynamic camera work. Every movement is captured with precision, realistic physics, and high-energy cinematography. The scene builds tension through dramatic timing and visual impact.",
      subject: "The central subject of the action scene captured in dynamic motion with professional framing.",
      action: "Fast-paced action sequence with realistic physics, precise movement, and cinematic timing.",
      environment: "Action-oriented environment with dramatic atmosphere and professional set design.",
      camera: "Dynamic handheld-style camera following the action with immersive intensity.",
      lens: "24mm wide-angle lens capturing the full scope of the action",
      movement: "Energetic camera movement following the action with stabilized dynamic shots.",
      lighting: "Dramatic action lighting with high contrast and cinematic shadows.",
      color_grading: "High-contrast cinematic color grade with enhanced drama.",
      realism: "Ultra realistic, 4K cinematic quality with accurate physics and dynamic motion blur.",
      style: "Hollywood action film style",
      duration: "10 seconds",
      negative_prompt: "low quality, blurry, distorted motion, unrealistic physics, bad anatomy, static, slow motion",
      music: "Intense cinematic soundtrack with driving percussion and orchestral hits",
      voice: "Energetic cinematic narration with commanding tone",
      full_prompt: "",
    },
  };

  /**
   * Build a prompt using keyword-matched cinematic templates.
   * NEVER includes the user's raw description in any field.
   */
  private buildDynamicFallback(
    platform: VideoPlatform,
    description: string
  ): VideoPrompt {
    const type = this.detectSceneType(description);
    const tmpl = this.fallbackTemplates[type]!;
    return { platform, ...tmpl };
  }

  /**
   * Validates that the AI output contains key concepts from the user's
   * description.  If critical elements are missing, merges them gracefully
   * without using the user's exact words.
   */
  private validateAndMergePrompt(
    prompt: VideoPrompt,
    description: string
  ): VideoPrompt {
    const desc = description.toLowerCase();
    const scene = prompt.scene.toLowerCase();
    const subject = prompt.subject.toLowerCase();

    // Detect scene type for natural merge phrasing
    const type = this.detectSceneType(description);

    // Keyword lists that should be present based on scene type
    const requiredHints: Record<string, string> = {
      vehicle: "high-speed vehicle motion",
      nature: "natural environment atmosphere",
      people: "character presence movement",
      action: "dynamic action intensity",
    };

    const hint = requiredHints[type] || requiredHints.action;
    const merged = { ...prompt };

    // Check scene for type-appropriate keywords
    const typeWords: Record<ReturnType<typeof this.detectSceneType>, string[]> = {
      vehicle: ["speed", "vehicle", "motion", "road", "drive"],
      nature: ["landscape", "nature", "light", "scene", "environment"],
      people: ["character", "subject", "presence", "expression"],
      action: ["action", "motion", "dynamic", "intense", "energy"],
    };

    const words = typeWords[type] || typeWords.action;
    const hasTypeContent = words.some((w) => scene.includes(w) || subject.includes(w));

    if (!hasTypeContent) {
      // Graceful merge: add a single natural sentence, no raw user words
      merged.scene = `${prompt.scene} The scene captures ${hint} with professional cinematic quality.`.trim();
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
