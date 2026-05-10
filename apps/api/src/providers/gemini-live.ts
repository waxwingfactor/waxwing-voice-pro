import { GoogleGenAI, Modality } from "@google/genai";
import { buildSystemInstruction } from "@waxwing/core";
import { getToolDeclarations } from "../tools/tool-declarations.js";

export interface GeminiLiveHandlers {
  onAudio(pcm24k: Buffer): void;
  onInputTranscript(text: string): void;
  onOutputTranscript(text: string): void;
  onToolCall(call: { id?: string; name: string; args: Record<string, unknown> }): Promise<void>;
  onError(error: unknown): void;
  onClose(): void;
}

export interface GeminiLiveSession {
  sendPcm16(pcm16: Buffer): void;
  sendToolResponse(response: {
    id?: string;
    name: string;
    response: Record<string, unknown>;
  }): void;
  close(): void;
}

export class GeminiLiveClient {
  constructor(private readonly params: { apiKey?: string; model: string }) {}

  async connect(
    context: { clientName?: string; timezone?: string },
    handlers: GeminiLiveHandlers
  ): Promise<GeminiLiveSession> {
    if (!this.params.apiKey) {
      return new NoopGeminiLiveSession();
    }

    const ai = new GoogleGenAI({
      apiKey: this.params.apiKey,
      httpOptions: { apiVersion: "v1alpha" }
    } as any);

    const session = await (ai as any).live.connect({
      model: this.params.model,
      callbacks: {
        onopen: () => undefined,
        onmessage: (message: unknown) => {
          this.handleMessage(message, handlers).catch(handlers.onError);
        },
        onerror: (event: unknown) => handlers.onError(event),
        onclose: () => handlers.onClose()
      },
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: buildSystemInstruction({
          clientName: context.clientName,
          timezone: context.timezone
        }),
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        enableAffectiveDialog: true,
        proactivity: { proactiveAudio: true },
        tools: [{ functionDeclarations: getToolDeclarations() }]
      }
    });

    return {
      sendPcm16: (pcm16: Buffer) => {
        session.sendRealtimeInput({
          audio: {
            data: pcm16.toString("base64"),
            mimeType: "audio/pcm;rate=16000"
          }
        });
      },
      sendToolResponse: (response) => {
        session.sendToolResponse({
          functionResponses: [
            {
              id: response.id,
              name: response.name,
              response: response.response
            }
          ]
        });
      },
      close: () => session.close()
    };
  }

  private async handleMessage(
    rawMessage: unknown,
    handlers: GeminiLiveHandlers
  ): Promise<void> {
    const message = normalizeLiveMessage(rawMessage);
    const audioData =
      message.data ??
      message.serverContent?.modelTurn?.parts?.find((part: any) => part.inlineData)?.inlineData
        ?.data;

    if (audioData) {
      handlers.onAudio(Buffer.from(audioData, "base64"));
    }

    const inputTranscript = message.serverContent?.inputTranscription?.text;
    if (inputTranscript) handlers.onInputTranscript(inputTranscript);

    const outputTranscript = message.serverContent?.outputTranscription?.text;
    if (outputTranscript) handlers.onOutputTranscript(outputTranscript);

    if (message.toolCall?.functionCalls) {
      for (const fc of message.toolCall.functionCalls) {
        await handlers.onToolCall({
          id: fc.id,
          name: fc.name,
          args: fc.args ?? {}
        });
      }
    }
  }
}

class NoopGeminiLiveSession implements GeminiLiveSession {
  sendPcm16(): void {}
  sendToolResponse(): void {}
  close(): void {}
}

function normalizeLiveMessage(raw: unknown): any {
  if (typeof raw === "object" && raw && "data" in raw && typeof (raw as any).data === "string") {
    try {
      return JSON.parse((raw as any).data);
    } catch {
      return raw;
    }
  }
  return raw;
}
