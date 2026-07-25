/**
 * Enterprise Image AI Prompt Service v2
 *
 * Generates structured image prompts for professional AI image generators.
 * Supports: GPT Image, Flux, Midjourney, Leonardo, Ideogram.
 *
 * The AI is instructed to return ONLY a JSON object with the canonical
 * schema.  If JSON parsing fails, a text-based field extractor attempts
 * to recover structured fields; otherwise a professional fallback is
 * returned that preserves user details and never uses generic text.
 */

import { BaseAIService } from "./base";
import type { ImagePrompt, ImagePlatform } from "@/types";
import type { PlanType } from "@/config/ai";
import { providerRegistry } from "./providers/registry";
import { logger } from "@/bot/core/logger";

const log = logger.child("ai-image");

// ─── Canonical keys for JSON parsing ──────────────────────────────

const CANONICAL_KEYS: Record<string, keyof ImagePrompt> = {
  platform: "platform",
  composition: "composition",
  lighting: "lighting",
  camera: "camera",
  mood: "mood",
  quality: "quality",
  "negative prompt": "negativePrompt",
  negative: "negativePrompt",
  "full prompt": "fullPrompt",
  fullprompt: "fullPrompt",
  prompt: "fullPrompt",
};

const HEADER_ALIASES = Object.keys(CANONICAL_KEYS).concat([
  "Full Prompt",
  "Negative Prompt",
  "Composition",
  "Camera",
]);

// ─── System prompt ─────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an award-winning commercial and cinematic AI image prompt engineer.

Your job is to transform simple user ideas into professional-grade photography and
cinematic image prompts for GPT Image, Flux, Midjourney, Leonardo and Ideogram.

Every prompt must read like a professional photography brief:
- Commercial product photography style or cinematic movie still
- Specific camera model, lens, and settings (aperture, shutter speed, ISO)
- Professional lighting setup (key light, fill light, rim light, practicals)
- Environmental and atmospheric details
- Color grading and tone mapping
- Resolution and quality parameters
- Negative prompt for artifact and distortion prevention

INCLUDE IN EVERY OUTPUT:
- Camera: specific camera type (e.g. "Sony A7R IV", "Hasselblad X1D II", "ARRI Alexa LF") + lens + focal length + aperture
- Lighting: key light direction and quality, fill light ratio, rim/hair light, practical sources
- Composition: framing, rule of thirds, leading lines, depth, foreground/midground/background
- Mood: emotional tone, atmosphere, color psychology
- Environment: setting details, time of day, weather, location atmosphere
- Style: photography genre (commercial, editorial, cinematic, architectural, portrait, automotive)
- Realism: texture detail, material properties, skin detail, environmental realism
- Quality: resolution (8K/16K), HDR, RAW processing, post-production style
- Negative prompt: artifacts, distortion, poor lighting, bad composition, quality issues

CRITICAL RULES:
- NEVER include the user's exact sentence in any field.
- Extract the meaning and rewrite it as a professional creative brief.
- Always preserve specific objects, brand names, numbers and colors from the user input.
- Never generalize: keep BMW M5 as BMW M5, motorcycle as motorcycle, 300 km/h as 300 km/h.
- Never replace specific model names with generic categories.
- Never repeat text.
- Return ONLY valid JSON.
- NEVER wrap JSON inside markdown code blocks.
- EVERY field MUST contain detailed generated content connected to the user's idea.
- No empty fields — every field must have a professional description.

Bad example (generic, empty, vague):
{
  "composition": "A photo of a car",
  "lighting": "Good lighting",
  "camera": "Camera shot",
  "mood": "Nice mood",
  "quality": "High quality"
}

Good example (professional, specific):
{
  "composition": "Dynamic low-angle three-quarter front view of a BMW M5 dominating the foreground, empty highway receding into the background under dramatic sunset sky, leading lines from road markings draw the eye to the horizon. Professional automotive photography composition with negative space for copy overlay.",
  "lighting": "Dramatic golden hour lighting with a large octabox key light positioned 45 degrees camera-left at 1/4 power creating cinematic shadows across the vehicle body, natural warm sunlight as fill, subtle rim light from the setting sun catching the vehicle edges, practical headlight illumination adding depth.",
  "camera": "Sony A7R IV with 70-200mm f/2.8 GM II lens at 135mm, aperture f/4.0 for deep enough focus on the entire vehicle while maintaining background separation, shutter 1/125s, ISO 100, two-stop ND filter for motion blur in wheels.",
  "mood": "Triumphant and powerful atmosphere with a sense of speed and precision engineering. The warm golden tones evoke luxury and success while the dramatic shadows add intensity and cinematic gravitas.",
  "quality": "8K commercial automotive photography, ultra-realistic paint reflections with accurate clear-coat rendering, carbon fiber texture visible, HDR processing with careful highlight rolloff, professional color grading with teal-orange split, subtle film grain added for cinematic texture, focus stacked for full vehicle sharpness.",
  "negativePrompt": "low quality, blurry, overexposed, underexposed, grainy, noisy, chromatic aberration, lens flare, distortion, cartoon style, bad anatomy, unrealistic reflections, flat lighting, oversaturated, composition errors, cropping issues, watermarks, text, logo",
  "fullPrompt": "Award-winning commercial automotive photography of a BMW M5 at golden hour on an empty highway. Sony A7R IV with 70-200mm f/2.8 at 135mm..."
}

You MUST respond with ONE JSON object with ALL of these fields filled with professional-level detail:

{
  "platform": "GPT Image",
  "composition": "Detailed composition description including framing, subject placement, depth, leading lines, foreground/midground/background",
  "lighting": "Complete lighting setup: key/fill/rim lights, modifiers, ratios, natural/practical sources, shadows",
  "camera": "Specific camera body, lens, focal length, aperture, shutter speed, ISO, filters",
  "mood": "Emotional tone, atmosphere, color psychology, viewer feeling",
  "quality": "Resolution, realism level, texture detail, HDR, post-production, color grading",
  "negativePrompt": "Comprehensive list of what to avoid: artifacts, distortions, quality issues",
  "fullPrompt": "Single complete professional prompt ready to paste into the AI image generator, combining all elements into a cohesive creative brief"
}

Return ONLY the JSON object. No markdown. No explanation. No code blocks.`;

// ─── Service ──────────────────────────────────────────────────────

export class ImageAIService extends BaseAIService {
  private readonly platforms: ImagePlatform[] = [
    "GPT Image",
    "Flux",
    "Midjourney",
    "Leonardo",
    "Ideogram",
  ];

  constructor() {
    super("image");
  }

  /**
   * Extract key elements from user description for the image prompt.
   */
  private extractElements(description: string): {
    subject: string;
    objects: string[];
    action: string;
    speed: string;
  } {
    const objects: string[] = [];

    // Brand detection
    const hasBMW = /\bbmw\b/i.test(description);
    const hasBMWM = /\bbmw\s+m[0-9]/i.test(description);
    const hasMercedes = /\bmercedes\b/i.test(description);
    const hasMercedesAMG = /\bmercedes\s+amg\b/i.test(description);
    const hasFerrari = /\bferrari\b/i.test(description);
    const hasLamborghini = /\blamborghini\b/i.test(description);
    const hasPorsche = /\bporsche\b/i.test(description);
    const hasMustang = /\bmustang\b/i.test(description);
    const hasTesla = /\btesla\b/i.test(description);

    if (hasBMWM) objects.push("a BMW M performance car");
    else if (hasBMW) objects.push("a BMW luxury sports sedan");
    if (hasMercedesAMG) objects.push("a Mercedes AMG sports sedan");
    else if (hasMercedes) objects.push("a Mercedes luxury sedan");
    if (hasFerrari) objects.push("a Ferrari supercar");
    if (hasLamborghini) objects.push("a Lamborghini supercar");
    if (hasPorsche) objects.push("a Porsche sports car");
    if (hasMustang) objects.push("a Ford Mustang muscle car");
    if (hasTesla) objects.push("a Tesla electric car");

    // Vehicle detection
    const hasMotorcycle = /moto(?![0-9])|motorcycle|bike|scooter/i.test(description) && !hasBMWM;
    const hasCar = /car|auto|sedan|suv|coupe|truck|lorry/i.test(description) &&
      !objects.some((o) => /car|vehicle|sedan/i.test(o));

    if (hasMotorcycle) objects.push("a superbike motorcycle");
    if (hasCar) objects.push("a sports car");

    if (objects.length === 0) objects.push(description.toLowerCase());

    // Subject
    const hasMoto = objects.some((o) => /motorcycle|bike|scooter/i.test(o));
    const hasAuto = objects.some((o) => /car|sedan|vehicle|truck/i.test(o));
    let subject = "a person";
    if (hasMoto && hasAuto) {
      subject = "a group of riders and drivers";
    } else if (hasMoto) {
      subject = /odam|rider|motorcyclist/i.test(description) ? "a motorcycle rider" : "a professional rider";
    } else if (hasAuto) {
      subject = /driver|man|woman|person/i.test(description) ? "a driver" : "a professional driver";
    } else if (/woman|girl|lady/i.test(description)) {
      subject = "a woman";
    } else if (/man|guy|boy|gentleman/i.test(description)) {
      subject = "a man";
    }

    // Action
    let action = "in motion";
    if (/ketayotgan|riding|driving|racing|chasing/i.test(description)) {
      if (hasMoto && hasAuto) action = "racing side by side";
      else if (hasMoto) action = "riding at extreme speed";
      else action = "driving at high speed";
    } else if (/uchayotgan|flying|soaring/i.test(description)) {
      action = "flying";
    } else if (/yugurayotgan|running|sprinting/i.test(description)) {
      action = "running";
    } else if (/suzayotgan|swimming|diving/i.test(description)) {
      action = "swimming";
    }

    // Speed
    let speed = "extreme speed";
    const speedMatch = description.match(/\d+\s*(km|km\/h|kph|mph|kmh)/gi);
    if (speedMatch) speed = speedMatch[0]!;

    return { subject, objects, action, speed };
  }

  async generatePrompt(
    description: string,
    platform?: ImagePlatform,
    modelId?: string,
    userPlan?: string | PlanType
  ): Promise<ImagePrompt[]> {
    const targetPlatforms = platform ? [platform] : this.platforms;
    const elements = this.extractElements(description);

    const objectsList = elements.objects.map((o) => "- " + o).join("\n");

    const userPrompt = [
      'Generate an image prompt for the following idea:',
      '',
      '"' + description + '"',
      '',
      'Key elements from this input:',
      '- Subject: ' + elements.subject,
      '- Objects:',
      objectsList,
      '- Action: ' + elements.action,
      '- Speed: ' + elements.speed,
      '',
      'IMPORTANT: Keep ALL of these specific objects in your output.',
      'Include every object listed above in the prompt. Never generalize brand names or specific items.',
      '',
      'Return ONE JSON object.',
    ].join("\n");

    log.info("[IMAGE_SERVICE] Calling AI", {
      description: description.slice(0, 50),
      platform,
      modelId: modelId ?? "default",
      elements: elements.objects,
    });

    try {
      const response = await this.executeAI(
        [{ role: "user", content: userPrompt }],
        SYSTEM_PROMPT,
        modelId,
        userPlan
      );

      log.info("[IMAGE_SERVICE] AI response received", {
        contentLength: response.content.length,
      });

      return this.parseResponse(response.content, targetPlatforms, description, elements);
    } catch (error) {
      // Log AIError details then re-throw — handler shows the friendly message
      const details: Record<string, unknown> = {
        description: description.slice(0, 50),
        platform,
        modelId: modelId ?? "default",
        error: String(error),
      };
      if (error instanceof Error && "code" in error) {
        const aiErr = error as any;
        details.errorCode = aiErr.code ?? "UNKNOWN";
        details.statusCode = aiErr.statusCode;
        details.provider = aiErr.provider;
      }
      log.error("[IMAGE_SERVICE] AI execution failed — re-throwing", details);
      throw error;
    }
  }

  // ── Parsing ──────────────────────────────────────────────────────

  private parseResponse(
    rawContent: string,
    targetPlatforms: ImagePlatform[],
    _description: string,
    elements: { subject: string; objects: string[]; action: string; speed: string }
  ): ImagePrompt[] {
    const cleaned = rawContent.replace(/```[\s\S]*?```/g, "").trim();

    const jsonStr = this.extractJsonString(cleaned);
    if (jsonStr) {
      const parsed = this.tryParseJson(jsonStr, targetPlatforms);
      if (parsed) return parsed;
    }

    const fields = this.extractFieldsFromText(cleaned);
    if (Object.keys(fields).length > 1) {
      return targetPlatforms.map((p) => this.buildFromFields(p, fields));
    }

    log.warn("[IMAGE_SERVICE] All parsing strategies failed, using safe fallback");
    return targetPlatforms.map((p) => this.buildSafeFallback(p, _description, elements));
  }

  private extractJsonString(text: string): string | null {
    const firstBrace = text.indexOf("{");
    const firstBracket = text.indexOf("[");
    const startIdx = firstBrace >= 0 ? firstBrace : firstBracket;
    if (startIdx < 0) return null;
    return text.substring(startIdx).trim();
  }

  private tryParseJson(
    text: string,
    targetPlatforms: ImagePlatform[]
  ): ImagePrompt[] | null {
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
        const results: ImagePrompt[] = arr
          .map((item, idx) => {
            const p = item as Record<string, unknown>;
            const platform = (p["platform"] as ImagePlatform) ?? targetPlatforms[idx] ?? targetPlatforms[0]!;
            return {
              platform,
              composition: this.safeStr(p["composition"]),
              lighting: this.safeStr(p["lighting"]),
              camera: this.safeStr(p["camera"]),
              mood: this.safeStr(p["mood"]),
              quality: this.safeStr(p["quality"]),
              negativePrompt: this.safeStr(p["negativePrompt"] ?? p["negative_prompt"] ?? p["negative"]),
              fullPrompt: this.safeStr(p["fullPrompt"] ?? p["full_prompt"] ?? p["prompt"]) || text,
            };
          })
          .filter((r): r is ImagePrompt => !!r.platform);
        if (results.length > 0) return results;
      } catch {
        // try next
      }
    }
    return null;
  }

  // ── Text-based fallback ─────────────────────────────────────────

  private extractFieldsFromText(text: string): Partial<Record<keyof ImagePrompt, string>> {
    const fields: Partial<Record<keyof ImagePrompt, string>> = {};
    const pattern = HEADER_ALIASES.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    const regex = new RegExp(
      "(?:^|\\n)\\s*(?:\\*{0,2})?(" + pattern + ")\\s*:\\s*(?:\\*{0,2})?([\\s\\S]*?)(?=\\n\\s*(?:" + pattern + ")\\s*:|\\n\\s*[-=]{3,}|$)",
      "gim"
    );
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const header = match[1]!.trim();
      const value = match[2]!.trim();
      if (!value) continue;
      const lower = header.toLowerCase().replace(/\s+/g, " ").trim();
      for (const [alias, field] of Object.entries(CANONICAL_KEYS)) {
        const spacedAlias = alias.replace(/_/g, " ");
        if (lower === alias || lower.startsWith(alias) || lower === spacedAlias || lower.startsWith(spacedAlias)) {
          fields[field] = fields[field] ? fields[field] + "\n" + value : value;
          break;
        }
      }
    }
    return fields;
  }

  private buildFromFields(
    platform: ImagePlatform,
    fields: Partial<Record<keyof ImagePrompt, string>>
  ): ImagePrompt {
    return {
      platform,
      composition: fields.composition || "",
      lighting: fields.lighting || "",
      camera: fields.camera || "",
      mood: fields.mood || "",
      quality: fields.quality || "",
      negativePrompt: fields.negativePrompt || "",
      fullPrompt: fields.fullPrompt || "",
    };
  }

  /**
   * Safe fallback built from detected elements — never generic.
   */
  private buildSafeFallback(
    platform: ImagePlatform,
    _description: string,
    elements: { subject: string; objects: string[]; action: string; speed: string }
  ): ImagePrompt {
    const objList = elements.objects
      .map((o) => o.replace(/^a |^an /, ""))
      .join(" and ");

    const composition = "A dynamic cinematic composition featuring " + objList + " as the main subject. The scene is captured with professional framing that emphasizes speed, motion, and dramatic visual impact.";
    const lighting = "Dramatic cinematic lighting with realistic shadows, golden hour warmth, and high contrast that enhances the mood of the scene.";
    const camera = "Low-angle shot with a 35mm cinema lens, shallow depth of field, capturing the subject in sharp focus against a motion-blurred background.";
    const mood = "Intense and dramatic atmosphere with a sense of high energy and cinematic tension.";
    const quality = "Ultra realistic, 8K resolution, professional photography style, highly detailed textures, lifelike colors, HDR quality.";
    const negativePrompt = "low quality, blurry, cartoon style, distorted objects, bad anatomy, unrealistic lighting, overexposed, underexposed, grainy, noisy";
    const fullPrompt = "A stunning cinematic photograph of " + objList + " " + elements.action + " at " + elements.speed + ". " + composition + " " + lighting + " " + mood + " Ultra realistic, 8K resolution, professional photography.";

    return {
      platform,
      composition,
      lighting,
      camera,
      mood,
      quality,
      negativePrompt,
      fullPrompt,
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private safeStr(val: unknown): string {
    if (typeof val === "string") return val;
    if (typeof val === "number" || typeof val === "boolean") return String(val);
    return "";
  }

  getPlatforms(): ImagePlatform[] {
    return [...this.platforms];
  }

  async generateImage(
    prompt: string,
    platform: string,
    modelId?: string
  ): Promise<string | Buffer> {
    const provider = providerRegistry.getProviderById(platform);
    if (!provider.generateImage) {
      throw new Error("The provider " + platform + " does not support direct image generation.");
    }
    return await provider.generateImage(prompt, modelId);
  }
}

export const imageAIService = new ImageAIService();
