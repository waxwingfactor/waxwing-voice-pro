import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AppRepository, ArtifactStorage } from "@waxwing/db";
import type { AgentSettings } from "@waxwing/core";
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
        miro: Boolean(
          deps.env.MIRO_DEFAULT_BOARD_ID &&
            (deps.env.MIRO_ACCESS_TOKEN || deps.env.MIRO_REFRESH_TOKEN)
        )
      },
      generatedAt: new Date().toISOString()
    };
  });

  app.get("/dashboard/calls/:callId", async (request, reply) => {
    if (!authorizeDashboardRequest(request, reply, deps.env)) return;

    const query = request.query as Record<string, string | undefined>;
    const params = request.params as Record<string, string | undefined>;
    const clientSlug = query.client_slug ?? "default";
    const callId = params.callId;
    if (!callId) {
      return reply.code(400).send({ error: "Missing call id." });
    }

    const detail = await deps.repository.getDashboardCall(clientSlug, callId);
    if (!detail) {
      return reply.code(404).send({ error: `Call not found: ${callId}` });
    }

    return {
      ...detail,
      call: {
        ...detail.call,
        audioFiles: await Promise.all(
          detail.call.audioFiles.map(async (file) => ({
            ...file,
            signedUrl: await createSignedAudioUrl(file.storagePath, deps.storage, app.log)
          }))
        )
      },
      generatedAt: new Date().toISOString()
    };
  });

  app.get("/dashboard/settings", async (request, reply) => {
    if (!authorizeDashboardRequest(request, reply, deps.env)) return;

    const query = request.query as Record<string, string | undefined>;
    const clientSlug = query.client_slug ?? "default";
    const client = await deps.repository.getClientBySlug(clientSlug);
    if (!client) {
      return reply.code(404).send({ error: `Client not found: ${clientSlug}` });
    }

    return {
      client: {
        id: client.id,
        slug: client.slug,
        name: client.name,
        timezone: client.timezone
      },
      settings: client.agentSettings,
      voiceOptions: VOICE_OPTIONS,
      generatedAt: new Date().toISOString()
    };
  });

  app.patch("/dashboard/settings", async (request, reply) => {
    if (!authorizeDashboardRequest(request, reply, deps.env)) return;

    const query = request.query as Record<string, string | undefined>;
    const clientSlug = query.client_slug ?? "default";
    const body = request.body as Record<string, unknown>;
    const settings = sanitizeAgentSettings(body);
    const client = await deps.repository
      .updateClientAgentSettings(clientSlug, settings)
      .catch((error) => {
        app.log.error({ error }, "Unable to update dashboard agent settings");
        throw error;
      });
    if (!client) {
      return reply.code(404).send({ error: `Client not found: ${clientSlug}` });
    }

    return {
      client: {
        id: client.id,
        slug: client.slug,
        name: client.name,
        timezone: client.timezone
      },
      settings: client.agentSettings,
      voiceOptions: VOICE_OPTIONS,
      generatedAt: new Date().toISOString()
    };
  });

  app.setErrorHandler((error, request, reply) => {
    if (request.method === "PATCH" && request.url.startsWith("/dashboard/settings")) {
      const message = error instanceof Error ? error.message : String(error);
      if (looksLikeMissingAgentSettingsMigration(message)) {
        return reply.code(409).send({
          error: "Agent settings migration has not been applied.",
          details:
            "Run supabase/migrations/0003_agent_settings.sql in the Supabase SQL editor, then redeploy or retry."
        });
      }
      return reply.code(500).send({
        error: "Unable to save agent settings.",
        details: message
      });
    }

    return reply.send(error);
  });
}

const VOICE_OPTIONS = [
  { name: "Kore", description: "Clear, professional, steady" },
  { name: "Puck", description: "Bright, energetic, friendly" },
  { name: "Aoede", description: "Warm, conversational, light" },
  { name: "Charon", description: "Calm, grounded, mature" },
  { name: "Fenrir", description: "Confident, direct, crisp" },
  { name: "Leda", description: "Soft, smooth, approachable" },
  { name: "Orus", description: "Measured, polished, neutral" },
  { name: "Zephyr", description: "Airy, upbeat, relaxed" }
];

function sanitizeAgentSettings(body: Record<string, unknown>): Partial<AgentSettings> {
  const settings: Partial<AgentSettings> = {
    agentName: boundedString(body.agentName, 40),
    voiceName: voiceName(body.voiceName),
    pace: option(body.pace, ["slow", "balanced", "fast"]),
    warmth: option(body.warmth, ["reserved", "balanced", "warm"]),
    initialGreeting: boundedString(body.initialGreeting, 240),
    minimumCreditScore: integerInRange(body.minimumCreditScore, 300, 850),
    incomeRentMultiple: numberInRange(body.incomeRentMultiple, 1, 6),
    autoBookShowings: booleanValue(body.autoBookShowings),
    askPetsOnNoPetProperties: booleanValue(body.askPetsOnNoPetProperties)
  };
  return compact(settings);
}

function boundedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function voiceName(value: unknown): string | undefined {
  const candidate = boundedString(value, 40);
  if (!candidate) return undefined;
  return VOICE_OPTIONS.some((option) => option.name === candidate) ? candidate : undefined;
}

function option<T extends string>(value: unknown, options: T[]): T | undefined {
  return typeof value === "string" && options.includes(value as T) ? (value as T) : undefined;
}

function integerInRange(value: unknown, min: number, max: number): number | undefined {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return undefined;
  return Math.min(max, Math.max(min, parsed));
}

function numberInRange(value: unknown, min: number, max: number): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(max, Math.max(min, Math.round(parsed * 100) / 100));
}

function booleanValue(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function compact<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as Partial<T>;
}

function looksLikeMissingAgentSettingsMigration(message: string): boolean {
  return [
    "agent_name",
    "agent_voice_name",
    "agent_pace",
    "agent_warmth",
    "agent_initial_greeting",
    "qualification_min_credit_score",
    "qualification_income_multiple",
    "auto_book_showings",
    "ask_pets_on_no_pet_properties"
  ].some((column) => message.includes(column));
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
