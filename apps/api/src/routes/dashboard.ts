import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AppRepository } from "@waxwing/db";
import type { AppEnv } from "../config/env.js";

export function registerDashboardRoutes(
  app: FastifyInstance,
  deps: {
    env: AppEnv;
    repository: AppRepository;
  }
): void {
  app.get("/dashboard", async (request, reply) => {
    if (!authorizeDashboardRequest(request, reply, deps.env)) return;

    const query = request.query as Record<string, string | undefined>;
    const clientSlug = query.client_slug ?? "default";
    const snapshot = await deps.repository.getDashboardSnapshot(clientSlug);
    if (!snapshot) {
      return reply.code(404).send({ error: `Client not found: ${clientSlug}` });
    }

    return {
      ...snapshot,
      integrations: {
        api: true,
        twilio: Boolean(deps.env.TWILIO_ACCOUNT_SID && deps.env.TWILIO_AUTH_TOKEN),
        gemini: Boolean(deps.env.GEMINI_API_KEY),
        resend: Boolean(deps.env.RESEND_API_KEY),
        googleCalendar: snapshot.counts.calendarConnections > 0,
        miro: Boolean(deps.env.MIRO_ACCESS_TOKEN && deps.env.MIRO_DEFAULT_BOARD_ID)
      },
      generatedAt: new Date().toISOString()
    };
  });
}

function authorizeDashboardRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  env: AppEnv
): boolean {
  if (!env.DASHBOARD_API_KEY) return true;

  const header = request.headers.authorization;
  if (header === `Bearer ${env.DASHBOARD_API_KEY}`) return true;

  reply.code(401).send({ error: "Unauthorized dashboard request." });
  return false;
}
