import type { AppRepository, ArtifactStorage } from "@waxwing/db";
import { decodeMuLawToPcm16, muLaw8kToWav, pcm16ToWav } from "./audio-codec.js";

interface TimedMuLawChunk {
  atMs: number;
  data: Buffer;
}

export class CallAudioRecorder {
  private inbound: Buffer[] = [];
  private outbound: Buffer[] = [];
  private inboundTimeline: TimedMuLawChunk[] = [];
  private outboundTimeline: TimedMuLawChunk[] = [];
  private firstChunkAtMs?: number;

  addInboundMuLawBase64(payload: string): void {
    const data = Buffer.from(payload, "base64");
    this.inbound.push(data);
    this.inboundTimeline.push({ atMs: this.elapsedMs(), data });
  }

  addOutboundMuLawBase64(payload: string): void {
    const data = Buffer.from(payload, "base64");
    this.outbound.push(data);
    this.outboundTimeline.push({ atMs: this.elapsedMs(), data });
  }

  async flush(params: {
    callId: string;
    storage: ArtifactStorage;
    repository: AppRepository;
  }): Promise<string[]> {
    const storedPaths: string[] = [];
    await this.storeTrack({
      ...params,
      kind: "inbound_raw_ulaw",
      chunks: this.inbound,
      path: `calls/${params.callId}/audio/inbound.raw.ulaw`
    });
    storedPaths.push(`calls/${params.callId}/audio/inbound.raw.ulaw`);
    await this.storePlayableTrack({
      ...params,
      kind: "inbound_wav",
      chunks: this.inbound,
      path: `calls/${params.callId}/audio/inbound.wav`
    });
    storedPaths.push(`calls/${params.callId}/audio/inbound.wav`);

    await this.storeTrack({
      ...params,
      kind: "outbound_raw_ulaw",
      chunks: this.outbound,
      path: `calls/${params.callId}/audio/outbound.raw.ulaw`
    });
    storedPaths.push(`calls/${params.callId}/audio/outbound.raw.ulaw`);
    await this.storePlayableTrack({
      ...params,
      kind: "outbound_wav",
      chunks: this.outbound,
      path: `calls/${params.callId}/audio/outbound.wav`
    });
    storedPaths.push(`calls/${params.callId}/audio/outbound.wav`);
    await this.storeConversationTrack({
      ...params,
      path: `calls/${params.callId}/audio/conversation.wav`
    });
    storedPaths.push(`calls/${params.callId}/audio/conversation.wav`);

    const metadataPath = `calls/${params.callId}/audio/metadata.json`;
    const metadata = Buffer.from(
      JSON.stringify(
        {
          format: "audio/x-mulaw",
          sampleRate: 8000,
          channels: 1,
          inboundBytes: Buffer.concat(this.inbound).length,
          outboundBytes: Buffer.concat(this.outbound).length,
          note:
            "conversation.wav is the browser-playable mixed call. Raw inbound and outbound tracks are retained for audit and recovery."
        },
        null,
        2
      )
    );
    await params.storage.upload(metadataPath, metadata, "application/json");
    await params.repository.recordCallAudio({
      callId: params.callId,
      kind: "metadata",
      storagePath: metadataPath,
      mimeType: "application/json",
      byteSize: metadata.byteLength
    });
    storedPaths.push(metadataPath);

    return storedPaths;
  }

  private async storeTrack(params: {
    callId: string;
    storage: ArtifactStorage;
    repository: AppRepository;
    kind: "inbound_raw_ulaw" | "outbound_raw_ulaw";
    chunks: Buffer[];
    path: string;
  }): Promise<void> {
    const body = Buffer.concat(params.chunks);
    await params.storage.upload(params.path, body, "application/octet-stream");
    await params.repository.recordCallAudio({
      callId: params.callId,
      kind: params.kind,
      storagePath: params.path,
      mimeType: "application/octet-stream",
      byteSize: body.byteLength
    });
  }

  private async storePlayableTrack(params: {
    callId: string;
    storage: ArtifactStorage;
    repository: AppRepository;
    kind: "inbound_wav" | "outbound_wav";
    chunks: Buffer[];
    path: string;
  }): Promise<void> {
    const body = muLaw8kToWav(Buffer.concat(params.chunks));
    await params.storage.upload(params.path, body, "audio/wav");
    await params.repository.recordCallAudio({
      callId: params.callId,
      kind: params.kind,
      storagePath: params.path,
      mimeType: "audio/wav",
      byteSize: body.byteLength
    });
  }

  private async storeConversationTrack(params: {
    callId: string;
    storage: ArtifactStorage;
    repository: AppRepository;
    path: string;
  }): Promise<void> {
    const body = mixMuLawTimelineToWav(this.inboundTimeline, this.outboundTimeline);
    await params.storage.upload(params.path, body, "audio/wav");
    await params.repository.recordCallAudio({
      callId: params.callId,
      kind: "mixed_wav",
      storagePath: params.path,
      mimeType: "audio/wav",
      byteSize: body.byteLength
    });
  }

  private elapsedMs(): number {
    const now = Date.now();
    this.firstChunkAtMs ??= now;
    return now - this.firstChunkAtMs;
  }
}

function mixMuLawTimelineToWav(
  inboundChunks: TimedMuLawChunk[],
  outboundChunks: TimedMuLawChunk[]
): Buffer {
  const sampleRate = 8000;
  const chunks = [...inboundChunks, ...outboundChunks];
  const totalSamples = chunks.reduce((max, chunk) => {
    const offsetSamples = Math.max(0, Math.round((chunk.atMs / 1000) * sampleRate));
    return Math.max(max, offsetSamples + chunk.data.byteLength);
  }, 0);

  if (totalSamples === 0) {
    return pcm16ToWav(Buffer.alloc(0), sampleRate);
  }

  const mixed = Buffer.alloc(totalSamples * 2);

  for (const chunk of inboundChunks) {
    const offsetSamples = Math.max(0, Math.round((chunk.atMs / 1000) * sampleRate));
    const pcm = decodeMuLawToPcm16(chunk.data);
    const sampleCount = Math.floor(pcm.byteLength / 2);
    for (let i = 0; i < sampleCount; i += 1) {
      const target = offsetSamples + i;
      if (target >= totalSamples) break;
      // Twilio's inbound stream can contain a faint copy of assistant audio on some calls.
      // The outbound pass below overwrites those samples so the assistant is not doubled.
      mixed.writeInt16LE(pcm.readInt16LE(i * 2), target * 2);
    }
  }

  for (const chunk of outboundChunks) {
    const offsetSamples = Math.max(0, Math.round((chunk.atMs / 1000) * sampleRate));
    const pcm = decodeMuLawToPcm16(chunk.data);
    const sampleCount = Math.floor(pcm.byteLength / 2);
    for (let i = 0; i < sampleCount; i += 1) {
      const target = offsetSamples + i;
      if (target >= totalSamples) break;
      mixed.writeInt16LE(clampPcm16(pcm.readInt16LE(i * 2)), target * 2);
    }
  }
  return pcm16ToWav(mixed, sampleRate);
}

function clampPcm16(value: number): number {
  return Math.max(-32768, Math.min(32767, value));
}
