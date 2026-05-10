import type { FastifyBaseLogger } from "fastify";
import type { WebSocket } from "ws";
import { ulid } from "ulid";
import {
  CallState,
  buildComplianceEvent,
  createCallSnapshot,
  shouldRefuseForFairHousing,
  type ClientProfile
} from "@waxwing/core";
import type { AppRepository, ArtifactStorage } from "@waxwing/db";
import type { GeminiLiveClient, GeminiLiveSession } from "../providers/gemini-live.js";
import type { GoogleCalendarProvider } from "../providers/google-calendar.js";
import type { TwilioCallProvider } from "../providers/twilio-call.js";
import type { PostCallWorker } from "../jobs/post-call-worker.js";
import type { TokenVault } from "../security/token-vault.js";
import { CallAudioRecorder } from "../media/audio-recorder.js";
import {
  geminiPcm24ToTwilioBase64MuLaw,
  twilioBase64MuLawToGeminiPcm16
} from "../media/audio-codec.js";
import { ToolRegistry } from "../tools/tool-registry.js";

export class TwilioMediaSession {
  private readonly recorder = new CallAudioRecorder();
  private geminiSession?: GeminiLiveSession;
  private callState?: CallState;
  private client?: ClientProfile;
  private streamSid?: string;
  private twilioCallSid?: string;
  private finalized = false;

  constructor(
    private readonly deps: {
      socket: WebSocket;
      log: FastifyBaseLogger;
      repository: AppRepository;
      storage: ArtifactStorage;
      gemini: GeminiLiveClient;
      calendar: GoogleCalendarProvider;
      tokenVault: TokenVault;
      twilio: TwilioCallProvider;
      postCallWorker: PostCallWorker;
    }
  ) {}

  async start(): Promise<void> {
    this.deps.socket.on("message", (raw) => {
      this.handleSocketMessage(raw.toString()).catch((error) => {
        this.deps.log.error({ error }, "Failed to process Twilio media message");
        this.failAndClose(error).catch((closeError) => {
          this.deps.log.error({ error: closeError }, "Failed to close broken media session");
        });
      });
    });
    this.deps.socket.on("close", () => {
      this.finalize("ended_without_lead").catch((error) => {
        this.deps.log.error({ error }, "Failed to finalize closed call");
      });
    });
  }

  private async handleSocketMessage(raw: string): Promise<void> {
    const message = JSON.parse(raw) as TwilioMessage;
    switch (message.event) {
      case "connected":
        return;
      case "start":
        await this.handleStart(message as TwilioStartMessage);
        return;
      case "media":
        this.handleMedia(message as TwilioMediaMessage);
        return;
      case "stop":
        await this.finalize("ended_without_lead");
        return;
      default:
        this.deps.log.debug({ event: message.event }, "Ignoring Twilio media event");
    }
  }

  private async handleStart(message: TwilioStartMessage): Promise<void> {
    this.streamSid = message.start.streamSid;
    this.twilioCallSid = message.start.callSid;
    const clientSlug = message.start.customParameters?.clientSlug ?? "default";
    const client = await this.deps.repository.getClientBySlug(clientSlug);
    if (!client) throw new Error(`No active client found for slug ${clientSlug}`);
    this.client = client;

    const snapshot = createCallSnapshot({
      id: ulid(),
      clientId: client.id,
      twilioCallSid: this.twilioCallSid
    });
    this.callState = new CallState(snapshot);
    await this.deps.repository.createCall(this.callState.value);

    const tools = new ToolRegistry({
      repository: this.deps.repository,
      calendar: this.deps.calendar,
      twilio: this.deps.twilio,
      tokenVault: this.deps.tokenVault,
      state: this.callState,
      client,
      twilioCallSid: this.twilioCallSid
    });

    this.geminiSession = await this.deps.gemini.connect(
      { clientName: client.name, timezone: client.timezone },
      {
        onAudio: (pcm24k) => this.sendAudioToTwilio(pcm24k),
        onInputTranscript: (text) => this.recordTranscript("caller", text),
        onOutputTranscript: (text) => this.recordTranscript("agent", text),
        onToolCall: async (toolCall) => {
          const response = await tools.execute(toolCall);
          this.geminiSession?.sendToolResponse({
            id: toolCall.id,
            name: toolCall.name,
            response
          });
          await this.deps.repository.updateCall(this.callState!.value);
        },
        onError: (error) => {
          this.deps.log.error({ error }, "Gemini Live error");
          this.failAndClose(error).catch((closeError) => {
            this.deps.log.error({ error: closeError }, "Failed to close Gemini error session");
          });
        },
        onClose: () => {
          this.deps.log.debug("Gemini Live session closed");
        }
      }
    );

    this.callState.activate();
    await this.deps.repository.updateCall(this.callState.value);
    this.geminiSession.sendText(
      "Start the phone call now with this exact short greeting: Hi, this is Morgan with Hunter Property Management. What property are you calling about?"
    );
  }

  private handleMedia(message: TwilioMediaMessage): void {
    if (!this.geminiSession) return;
    const payload = message.media.payload;
    this.recorder.addInboundMuLawBase64(payload);
    const pcm16 = twilioBase64MuLawToGeminiPcm16(payload);
    this.geminiSession.sendPcm16(pcm16);
  }

  private sendAudioToTwilio(pcm24k: Buffer): void {
    if (!this.streamSid) return;
    const payload = geminiPcm24ToTwilioBase64MuLaw(pcm24k);
    this.recorder.addOutboundMuLawBase64(payload);
    this.deps.socket.send(
      JSON.stringify({
        event: "media",
        streamSid: this.streamSid,
        media: { payload }
      })
    );
    this.deps.socket.send(
      JSON.stringify({
        event: "mark",
        streamSid: this.streamSid,
        mark: { name: `audio-${Date.now()}` }
      })
    );
  }

  private recordTranscript(speaker: "caller" | "agent", text: string): void {
    if (!this.callState) return;
    this.callState.addTranscript(speaker, text);
    if (speaker === "caller" && shouldRefuseForFairHousing(text)) {
      this.callState.addComplianceEvent(buildComplianceEvent(text));
    }
    this.deps.repository.updateCall(this.callState.value).catch((error) => {
      this.deps.log.warn({ error }, "Failed to persist transcript update");
    });
  }

  private async finalize(defaultOutcome: "ended_without_lead" | "failed"): Promise<void> {
    if (this.finalized || !this.callState || !this.client) return;
    this.finalized = true;
    this.geminiSession?.close();

    const current = this.callState.value;
    if (current.status !== "ended" && current.status !== "failed") {
      this.callState.end(current.outcome ?? defaultOutcome);
    }

    const audioPaths = await this.recorder.flush({
      callId: this.callState.value.id,
      storage: this.deps.storage,
      repository: this.deps.repository
    });

    await this.deps.repository.updateCall(this.callState.value);
    await this.deps.postCallWorker.finalize({
      call: this.callState.value,
      client: this.client,
      audioPaths
    });
  }

  private async failAndClose(error: unknown): Promise<void> {
    if (this.finalized) return;
    if (this.callState) {
      this.callState.fail(error instanceof Error ? error.message : String(error));
      await this.deps.repository.updateCall(this.callState.value).catch((updateError) => {
        this.deps.log.warn({ error: updateError }, "Failed to persist failed call state");
      });
    }
    this.geminiSession?.close();
    this.deps.socket.close();
  }
}

type TwilioMessage =
  | { event: "connected" }
  | TwilioStartMessage
  | TwilioMediaMessage
  | { event: "stop" }
  | { event: string };

interface TwilioStartMessage {
  event: "start";
  start: {
    streamSid: string;
    callSid: string;
    customParameters?: Record<string, string>;
  };
}

interface TwilioMediaMessage {
  event: "media";
  media: {
    payload: string;
  };
}
