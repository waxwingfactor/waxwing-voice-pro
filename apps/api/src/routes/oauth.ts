import type { FastifyInstance } from "fastify";
import type { AppEnv } from "../config/env.js";
import type { GoogleCalendarProvider } from "../providers/google-calendar.js";

export function registerOAuthRoutes(
  app: FastifyInstance,
  deps: { env: AppEnv; calendar: GoogleCalendarProvider }
): void {
  app.get("/google/oauth/start", async (_request, reply) => {
    const url = deps.calendar.getAuthorizationUrl();
    if (!url) {
      return reply.code(501).send({
        error: "Google OAuth is not configured. See docs/secrets-setup.md."
      });
    }
    return reply.redirect(url);
  });

  app.get("/google/oauth/callback", async (request, reply) => {
    const code = (request.query as Record<string, string | undefined>).code;
    if (!code) return reply.code(400).send({ error: "Missing OAuth code." });
    const tokens = await deps.calendar.exchangeCode(code);
    return reply.send({
      connected: true,
      note: "Persist the encrypted refresh token to calendar_connections before production use.",
      scopes: tokens.scope
    });
  });

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
