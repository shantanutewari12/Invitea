/**
 * Text hygiene for anything that ends up in an invite. The renderer never uses
 * innerHTML (React escapes text), but we also strip markup and links so stored
 * specs stay clean and the LLM can never smuggle in URLs or scripts.
 */

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
const HTML_TAG = /<\/?[a-zA-Z!][^>]*>/g;
const URL_LIKE = /\b(?:https?:\/\/|www\.|javascript:|data:|vbscript:)\S*/gi;

export interface SanitizeOptions {
  /** Remove anything that looks like a URL or script scheme (used for LLM output). */
  stripUrls?: boolean;
  /** Keep newlines (multi-line copy). Default: collapse to single spaces. */
  keepNewlines?: boolean;
}

/** Truncate by Unicode code points so emoji and combining marks are not cut in half. */
export function truncate(value: string, max: number): string {
  const chars = Array.from(value);
  return chars.length <= max ? value : chars.slice(0, max).join("").trimEnd();
}

export function sanitizeText(input: unknown, max: number, options: SanitizeOptions = {}): string {
  if (typeof input !== "string") return "";
  let text = input.normalize("NFC").replace(CONTROL_CHARS, "");
  text = text.replace(HTML_TAG, " ");
  if (options.stripUrls) text = text.replace(URL_LIKE, " ");
  text = options.keepNewlines
    ? text
        .split(/\r?\n/)
        .map((line) => line.replace(/[ \t]+/g, " ").trim())
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    : text.replace(/\s+/g, " ").trim();
  return truncate(text, max);
}

/** Only `{guest_name}` is a valid placeholder. Any other `{...}` is removed. */
export function normalizePlaceholders(template: string): string {
  const placeholder = "{guest_name}";
  return template
    .split(placeholder)
    .map((part) => part.replace(/\{[^{}]*\}/g, "").replace(/[{}]/g, ""))
    .join(placeholder)
    .replace(/\s+/g, " ")
    .trim();
}
