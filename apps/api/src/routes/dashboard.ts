import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AppRepository, ArtifactStorage } from "@waxwing/db";
import type { AppEnv } from "../config/env.js";

export function registerDashboardRoutes(
  app: FastifyInstance,
  deps: {
    env: AppEnv;
    repository: AppRepository;
    storage: ArtifactStorage;
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
    const recentCalls = await Promise.all(
      snapshot.recentCalls.map(async (call) => ({
        ...call,
        audioFiles: await Promise.all(
          call.audioFiles.map(async (file) => ({
            ...file,
            signedUrl: await createSignedAudioUrl(file.storagePath, deps.storage, app.log)
          }))
        )
      }))
    );

    return {
      ...snapshot,
      recentCalls,
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

async function createSignedAudioUrl(
  storagePath: string,
  storage: ArtifactStorage,
  log: FastifyInstance["log"]
): Promise<string | undefined> {
  try {
    return await storage.createSignedUrl(storagePath, 60 * 60 * 8);
  } catch (error) {
    log.warn({ error, storagePath }, "Unable to create dashboard audio URL");
    return undefined;
  }
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
