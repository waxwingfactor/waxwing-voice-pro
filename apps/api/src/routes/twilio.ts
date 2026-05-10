import type { FastifyInstance } from "fastify";
import type { AppRepository, ArtifactStorage } from "@waxwing/db";
import type { AppEnv } from "../config/env.js";
import type { GeminiLiveClient } from "../providers/gemini-live.js";
import type { GoogleCalendarProvider } from "../providers/google-calendar.js";
import type { TwilioCallProvider } from "../providers/twilio-call.js";
import type { PostCallWorker } from "../jobs/post-call-worker.js";
import { TwilioMediaSession } from "../voice/twilio-media-session.js";

export function registerTwilioRoutes(
  app: FastifyInstance,
  deps: {
    env: AppEnv;
    repository: AppRepository;
    storage: ArtifactStorage;
    gemini: GeminiLiveClient;
    calendar: GoogleCalendarProvider;
    twilio: TwilioCallProvider;
    postCallWorker: PostCallWorker;
  }
): void {
  app.post("/twilio/voice", async (request, reply) => {
    const body = request.body as Record<string, string | undefined>;
    const clientSlug = body.To ? "default" : "default";
    const streamUrl = new URL("/twilio/media", deps.env.TWILIO_WEBHOOK_BASE_URL);
    streamUrl.protocol = streamUrl.protocol === "https:" ? "wss:" : "ws:";

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${escapeXml(streamUrl.toString())}">
      <Parameter name="clientSlug" value="${escapeXml(clientSlug)}" />
    </Stream>
  </Connect>
</Response>`;

    return reply.type("text/xml").send(twiml);
  });

  app.post("/twilio/status", async (request, reply) => {
    await deps.repository.appendCallEvent({
      callId: String((request.body as Record<string, unknown>).CallSid ?? "unknown"),
      eventType: "twilio_status_callback",
      payload: request.body as Record<string, unknown>
    }).catch((error) => {
      request.log.warn({ error }, "Unable to store Twilio status callback");
    });
    return reply.code(204).send();
  });

  app.get("/twilio/media", { websocket: true }, (socket, request) => {
    const session = new TwilioMediaSession({
      socket,
      log: request.log,
      repository: deps.repository,
      storage: deps.storage,
      gemini: deps.gemini,
      calendar: deps.calendar,
      twilio: deps.twilio,
      postCallWorker: deps.postCallWorker
    });

    session.start().catch((error) => {
      request.log.error({ error }, "Media session failed");
      socket.close();
    });
  });
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
