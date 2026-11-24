import "server-only";
import { z } from "zod";

/**
 * Server-side environment access. Each group is parsed lazily so the app still
 * builds and unrelated routes still work when a group (e.g. Razorpay) is not
 * configured yet. Error messages list variable NAMES only, never values.
 */

export class EnvError extends Error {
  constructor(
    public readonly group: string,
    public readonly missing: string[],
  ) {
    super(`Missing or invalid environment variables for ${group}: ${missing.join(", ")}`);
    this.name = "EnvError";
  }
}

function parseGroup<S extends z.ZodObject<z.ZodRawShape>>(
  group: string,
  schema: S,
  source: Record<string, string | undefined> = process.env,
): z.infer<S> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const missing = [...new Set(result.error.issues.map((i) => String(i.path[0] ?? "unknown")))];
    throw new EnvError(group, missing);
  }
  return result.data;
}

const supabaseSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const supabaseAdminSchema = supabaseSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const geminiSchema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),
});

const razorpaySchema = z.object({
  RAZORPAY_KEY_ID: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),
});

const razorpayWebhookSchema = z.object({
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1),
});

export const getSupabaseEnv = (source?: Record<string, string | undefined>) =>
  parseGroup("Supabase", supabaseSchema, source);

export const getSupabaseAdminEnv = (source?: Record<string, string | undefined>) =>
  parseGroup("Supabase admin", supabaseAdminSchema, source);

export const getGeminiEnv = (source?: Record<string, string | undefined>) =>
  parseGroup("Gemini", geminiSchema, source);

export const getRazorpayEnv = (source?: Record<string, string | undefined>) =>
  parseGroup("Razorpay", razorpaySchema, source);

export const getRazorpayWebhookEnv = (source?: Record<string, string | undefined>) =>
  parseGroup("Razorpay webhook", razorpayWebhookSchema, source);

/** E2E only: serve in-memory fixtures instead of Supabase. Never set this on a real deployment. */
export const isE2EFixtureMode = () =>
  process.env.REGALIA_E2E_FIXTURES === "1" && process.env.VERCEL_ENV !== "production";
