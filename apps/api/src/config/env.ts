import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(8787),
  API_BASE_URL: z.string().url().default("http://localhost:8787"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  OWNER_NOTIFICATION_EMAIL: z.string().email().optional(),
  SESSION_SECRET: z.string().optional(),
  WEBHOOK_SIGNING_SECRET: z.string().optional(),
  ENCRYPTION_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),

  GEMINI_API_KEY: z.string().optional(),
  GEMINI_LIVE_MODEL: z.string().default("gemini-3.1-flash-live-preview"),

  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  TWILIO_WEBHOOK_BASE_URL: z.string().url().default("http://localhost:8787"),

  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default("call-artifacts"),

  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default("Morgan Leasing <calls@example.com>"),
  RESEND_REPLY_TO: z.string().email().optional(),

  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),

  MIRO_CLIENT_ID: z.string().optional(),
  MIRO_CLIENT_SECRET: z.string().optional(),
  MIRO_REDIRECT_URI: z.string().url().optional(),
  MIRO_DEFAULT_BOARD_ID: z.string().optional(),
  MIRO_ACCESS_TOKEN: z.string().optional(),
  MIRO_WEBHOOK_SECRET: z.string().optional()
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(): AppEnv {
  const parsed = envSchema.parse(process.env);
  if (parsed.NODE_ENV === "production") {
    const required: Array<keyof AppEnv> = [
      "GEMINI_API_KEY",
      "TWILIO_ACCOUNT_SID",
      "TWILIO_AUTH_TOKEN",
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "RESEND_API_KEY",
      "GOOGLE_OAUTH_CLIENT_ID",
      "GOOGLE_OAUTH_CLIENT_SECRET",
      "MIRO_CLIENT_ID",
      "MIRO_CLIENT_SECRET",
      "ENCRYPTION_KEY"
    ];
    const missing = required.filter((key) => !parsed[key]);
    if (missing.length > 0) {
      throw new Error(`Missing production environment variables: ${missing.join(", ")}`);
    }
  }
  return parsed;
}
