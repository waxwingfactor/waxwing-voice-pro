import formbody from "@fastify/formbody";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";
import { SupabaseAppRepository, SupabaseArtifactStorage } from "@waxwing/db";
import type { AppEnv } from "./config/env.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { registerTwilioRoutes } from "./routes/twilio.js";
import { registerOAuthRoutes } from "./routes/oauth.js";
import { InMemoryRepository, InMemoryStorage } from "./testing/in-memory.js";
import { GeminiLiveClient } from "./providers/gemini-live.js";
import { GoogleCalendarProvider } from "./providers/google-calendar.js";
import { MiroProvider } from "./providers/miro.js";
import { ResendEmailProvider } from "./providers/resend-email.js";
import { TwilioCallProvider } from "./providers/twilio-call.js";
import { PostCallWorker } from "./jobs/post-call-worker.js";
import { TokenVault } from "./security/token-vault.js";

export async function buildServer(env: AppEnv): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug"
    }
  });

  await app.register(formbody);
  await app.register(websocket);

  const repository =
    env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
      ? SupabaseAppRepository.fromEnv({
          supabaseUrl: env.SUPABASE_URL,
          serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY
        })
      : new InMemoryRepository();

  const storage =
    env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
      ? SupabaseArtifactStorage.fromEnv({
          supabaseUrl: env.SUPABASE_URL,
          serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
          bucket: env.SUPABASE_STORAGE_BUCKET
        })
      : new InMemoryStorage();

  const gemini = new GeminiLiveClient({
    apiKey: env.GEMINI_API_KEY,
    model: env.GEMINI_LIVE_MODEL
  });

  const calendar = new GoogleCalendarProvider({
    clientId: env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: env.GOOGLE_REDIRECT_URI
  });
  const tokenVault = new TokenVault(env.ENCRYPTION_KEY);

  const twilio = new TwilioCallProvider({
    accountSid: env.TWILIO_ACCOUNT_SID,
    authToken: env.TWILIO_AUTH_TOKEN
  });

  const email = new ResendEmailProvider({
    apiKey: env.RESEND_API_KEY,
    from: env.RESEND_FROM_EMAIL,
    replyTo: env.RESEND_REPLY_TO,
    ownerEmail: env.OWNER_NOTIFICATION_EMAIL
  });

  const miro = new MiroProvider({
    defaultBoardId: env.MIRO_DEFAULT_BOARD_ID,
    accessToken: env.MIRO_ACCESS_TOKEN,
    refreshToken: env.MIRO_REFRESH_TOKEN,
    clientId: env.MIRO_CLIENT_ID,
    clientSecret: env.MIRO_CLIENT_SECRET
  });

  const postCallWorker = new PostCallWorker({
    repository,
    storage,
    email,
    miro,
    miroAccessToken: env.MIRO_ACCESS_TOKEN
  });

  registerHealthRoutes(app);
  registerDashboardRoutes(app, { env, repository, storage });
  registerOAuthRoutes(app, { env, calendar, repository, tokenVault });
  registerTwilioRoutes(app, {
    env,
    repository,
    storage,
    gemini,
    calendar,
    tokenVault,
    twilio,
    postCallWorker
  });

  return app;
}
