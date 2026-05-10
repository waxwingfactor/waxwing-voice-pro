import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AppRepository } from "@waxwing/db";
import type { AppEnv } from "../config/env.js";
import type { GoogleCalendarProvider } from "../providers/google-calendar.js";
import type { TokenVault } from "../security/token-vault.js";

export function registerOAuthRoutes(
  app: FastifyInstance,
  deps: {
    env: AppEnv;
    calendar: GoogleCalendarProvider;
    repository: AppRepository;
    tokenVault: TokenVault;
  }
): void {
  const startGoogleOAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string | undefined>;
    const clientSlug = query.client_slug ?? query.clientSlug ?? "default";
    const calendarId =
      query.calendar_id ?? query.calendarId ?? query.google_account_email ?? query.email;
    const googleAccountEmail = query.google_account_email ?? query.email ?? calendarId;

    if (!calendarId || !googleAccountEmail) {
      return reply.code(400).send({
        error:
          "Missing calendar_id. Try /google/oauth/start?client_slug=default&calendar_id=alex@example.com"
      });
    }

    const client = await deps.repository.getClientBySlug(clientSlug);
    if (!client) {
      return reply.code(404).send({ error: `Client slug not found: ${clientSlug}` });
    }

    const state = signState(
      {
        clientSlug,
        calendarId,
        googleAccountEmail,
        issuedAt: Date.now()
      },
      oauthStateSecret(deps.env)
    );
    const url = deps.calendar.getAuthorizationUrl(state);
    if (!url) {
      return reply.code(501).send({
        error: "Google OAuth is not configured. See docs/secrets-setup.md."
      });
    }
    return reply.redirect(url);
  };

  const completeGoogleOAuth = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const query = request.query as Record<string, string | undefined>;
    const code = query.code;
    const rawState = query.state;
    if (!code) return reply.code(400).send({ error: "Missing OAuth code." });
    if (!rawState) return reply.code(400).send({ error: "Missing OAuth state." });

    const state = verifyState(rawState, oauthStateSecret(deps.env));
    if (!state) return reply.code(400).send({ error: "Invalid or expired OAuth state." });

    const client = await deps.repository.getClientBySlug(state.clientSlug);
    if (!client) {
      return reply.code(404).send({ error: `Client slug not found: ${state.clientSlug}` });
    }

    const tokens = await deps.calendar.exchangeCode(code);
    const refreshToken = String(tokens.refresh_token ?? "");
    if (!refreshToken) {
      return reply.code(400).send({
        error:
          "Google did not return a refresh token. Revoke this app in the Google account permissions, then retry the OAuth start URL."
      });
    }
    const scopes =
      typeof tokens.scope === "string"
        ? tokens.scope.split(" ").filter(Boolean)
        : [];

    await deps.repository.upsertCalendarConnection({
      clientId: client.id,
      calendarId: state.calendarId,
      googleAccountEmail: state.googleAccountEmail,
      encryptedRefreshToken: deps.tokenVault.encrypt(refreshToken),
      scopes
    });

    return reply.send({
      connected: true,
      client: client.name,
      client_slug: client.slug,
      calendar_id: state.calendarId,
      google_account_email: state.googleAccountEmail,
      scopes
    });
  };

  app.get("/google/oauth/start", startGoogleOAuth);
  app.get("/oauth/google/start", startGoogleOAuth);
  app.get("/google/oauth/callback", completeGoogleOAuth);
  app.get("/oauth/google/callback", completeGoogleOAuth);

  app.get("/miro/oauth/start", async (_request, reply) => {
    if (!deps.env.MIRO_CLIENT_ID || !deps.env.MIRO_REDIRECT_URI) {
      return reply.code(501).send({
        error: "Miro OAuth is not configured. See docs/secrets-setup.md."
      });
    }
    const params = new URLSearchParams({
      response_type: "code",
      client_id: deps.env.MIRO_CLIENT_ID,
      redirect_uri: deps.env.MIRO_REDIRECT_URI,
      scope: "boards:read boards:write"
    });
    return reply.redirect(`https://miro.com/oauth/authorize?${params.toString()}`);
  });
}

interface GoogleOAuthState {
  clientSlug: string;
  calendarId: string;
  googleAccountEmail: string;
  issuedAt: number;
}

function oauthStateSecret(env: AppEnv): string {
  return env.SESSION_SECRET ?? env.WEBHOOK_SIGNING_SECRET ?? env.ENCRYPTION_KEY ?? "dev-only";
}

function signState(state: GoogleOAuthState, secret: string): string {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyState(rawState: string, secret: string): GoogleOAuthState | null {
  const [payload, signature] = rawState.split(".");
  if (!payload || !signature) return null;

  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (
    expectedBuffer.byteLength !== actualBuffer.byteLength ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as GoogleOAuthState;
    const maxAgeMs = 30 * 60 * 1000;
    if (!decoded.issuedAt || Date.now() - decoded.issuedAt > maxAgeMs) return null;
    if (!decoded.clientSlug || !decoded.calendarId || !decoded.googleAccountEmail) return null;
    return decoded;
  } catch {
    return null;
  }
}
