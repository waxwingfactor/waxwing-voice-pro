import { z } from "zod";

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional()
);
const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional()
);
const optionalEmail = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().email().optional()
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(8787),
  API_BASE_URL: z.string().url().default("http://localhost:8787"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  OWNER_NOTIFICATION_EMAIL: optionalEmail,
  SESSION_SECRET: optionalString,
  WEBHOOK_SIGNING_SECRET: optionalString,
  ENCRYPTION_KEY: optionalString,
  SENTRY_DSN: optionalUrl,

  GEMINI_API_KEY: optionalString,
  GEMINI_LIVE_MODEL: z.string().default("gemini-2.5-flash-native-audio-preview-12-2025"),

  TWILIO_ACCOUNT_SID: optionalString,
  TWILIO_AUTH_TOKEN: optionalString,
  TWILIO_PHONE_NUMBER: optionalString,
  TWILIO_WEBHOOK_BASE_URL: z.string().url().default("http://localhost:8787"),

  SUPABASE_URL: optionalUrl,
  SUPABASE_ANON_KEY: optionalString,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  DATABASE_URL: optionalString,
  SUPABASE_STORAGE_BUCKET: z.string().default("call-artifacts"),

  RESEND_API_KEY: optionalString,
  RESEND_FROM_EMAIL: z.string().default("Morgan Leasing <calls@example.com>"),
  RESEND_REPLY_TO: optionalEmail,

  GOOGLE_OAUTH_CLIENT_ID: optionalString,
  GOOGLE_OAUTH_CLIENT_SECRET: optionalString,
  GOOGLE_REDIRECT_URI: optionalUrl,

  MIRO_CLIENT_ID: optionalString,
  MIRO_CLIENT_SECRET: optionalString,
  MIRO_REDIRECT_URI: optionalUrl,
  MIRO_DEFAULT_BOARD_ID: optionalString,
  MIRO_ACCESS_TOKEN: optionalString,
  MIRO_WEBHOOK_SECRET: optionalString
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
      "ENCRYPTION_KEY"
    ];
    const missing = required.filter((key) => !parsed[key]);
    if (missing.length > 0) {
      throw new Error(`Missing production environment variables: ${missing.join(", ")}`);
    }
  }
  return parsed;
}
