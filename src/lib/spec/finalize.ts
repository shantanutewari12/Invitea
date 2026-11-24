import { greeting } from "@/copy/en";

import { GUEST_NAME_PLACEHOLDER, LIMITS } from "./constants";
import { ensureAccessiblePalette } from "./contrast";
import { normalizePlaceholders, sanitizeText, type SanitizeOptions } from "./sanitize";
import {
  inviteSpecSchema,
  llmStyleSchema,
  type InviteSpec,
  type LlmStyle,
} from "./schema";

type Dict = Record<string, unknown>;

const isDict = (value: unknown): value is Dict =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced ? fenced[1] : trimmed;
}

/** Accepts an object or a JSON string (optionally fenced) and returns a plain object or null. */
export function coerceJsonObject(raw: unknown): Dict | null {
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(stripJsonFences(raw));
      return isDict(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return isDict(raw) ? raw : null;
}

function cleanCopyFields(draft: Dict, options: SanitizeOptions): Dict {
  const out: Dict = { ...draft };
  const field = (key: string, max: number) => {
    if (key in out) out[key] = sanitizeText(out[key], max, options);
  };
  field("headline", LIMITS.headline);
  field("subheadline", LIMITS.subheadline);
  field("greetingTemplate", LIMITS.greeting);
  field("closingNote", LIMITS.closingNote);
  if (typeof out.greetingTemplate === "string") {
    out.greetingTemplate = normalizePlaceholders(out.greetingTemplate);
  }
  return out;
}

export interface ParsedStyle {
  style: LlmStyle;
  warnings: string[];
}

export type ParseStyleResult = ({ ok: true } & ParsedStyle) | { ok: false; error: string };

/**
 * Validate raw LLM output. The model may only choose whitelisted template,
 * typography and animation ids and supply plain-text copy and hex colours.
 * Anything else is rejected (callers retry once, then use the default template).
 */
export function parseLlmStyle(raw: unknown): ParseStyleResult {
  const obj = coerceJsonObject(raw);
  if (!obj) return { ok: false, error: "LLM output is not a JSON object" };

  const cleaned = cleanCopyFields(obj, { stripUrls: true });
  const parsed = llmStyleSchema.safeParse(cleaned);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }

  const warnings: string[] = [];
  const style = { ...parsed.data };

  const palette = ensureAccessiblePalette(style.palette, style.template);
  if (palette.usedFallback) warnings.push(`palette-fallback:${palette.failures.join(",")}`);
  style.palette = palette.palette;

  if (!style.greetingTemplate.includes(GUEST_NAME_PLACEHOLDER)) {
    warnings.push("greeting-fallback");
    style.greetingTemplate = greeting.default;
  }

  return { ok: true, style, warnings };
}

export type FinalizeResult =
  | { ok: true; spec: InviteSpec; warnings: string[] }
  | { ok: false; error: string };

/**
 * Sanitise, apply the contrast fallback and validate a full spec. Used for
 * every spec that is stored (create, builder save) regardless of its origin.
 */
export function finalizeSpec(raw: unknown, options: SanitizeOptions = {}): FinalizeResult {
  const obj = coerceJsonObject(raw);
  if (!obj) return { ok: false, error: "Spec is not an object" };

  const draft = cleanCopyFields(obj, options);

  if (Array.isArray(draft.hosts)) {
    draft.hosts = draft.hosts
      .map((h) => sanitizeText(h, LIMITS.hostName, options))
      .filter((h) => h.length > 0);
  }
  if (Array.isArray(draft.events)) {
    draft.events = draft.events.map((event: unknown) => {
      if (!isDict(event)) return event;
      return {
        ...event,
        title: sanitizeText(event.title, LIMITS.eventTitle, options),
        venueName: sanitizeText(event.venueName ?? "", LIMITS.venueName, options),
        address: sanitizeText(event.address ?? "", LIMITS.address, options),
        mapUrl: typeof event.mapUrl === "string" ? event.mapUrl.trim() : "",
      };
    });
  }

  const warnings: string[] = [];
  if (isDict(draft.palette) && typeof draft.template === "string") {
    const template = draft.template as InviteSpec["template"];
    // Unknown templates are rejected by the schema below; only run the check for known ids.
    if (llmStyleSchema.shape.template.safeParse(template).success) {
      const palette = ensureAccessiblePalette(draft.palette, template);
      if (palette.usedFallback) warnings.push(`palette-fallback:${palette.failures.join(",")}`);
      draft.palette = palette.palette;
    }
  }

  if (typeof draft.greetingTemplate === "string" && !draft.greetingTemplate.includes(GUEST_NAME_PLACEHOLDER)) {
    warnings.push("greeting-fallback");
    draft.greetingTemplate = greeting.default;
  }

  const parsed = inviteSpecSchema.safeParse(draft);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  return { ok: true, spec: parsed.data, warnings };
}
