import type { AppRepository, ArtifactStorage } from "@waxwing/db";

export class CallAudioRecorder {
  private inbound: Buffer[] = [];
  private outbound: Buffer[] = [];

  addInboundMuLawBase64(payload: string): void {
    this.inbound.push(Buffer.from(payload, "base64"));
  }

  addOutboundMuLawBase64(payload: string): void {
    this.outbound.push(Buffer.from(payload, "base64"));
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

    await this.storeTrack({
      ...params,
      kind: "outbound_raw_ulaw",
      chunks: this.outbound,
      path: `calls/${params.callId}/audio/outbound.raw.ulaw`
    });
    storedPaths.push(`calls/${params.callId}/audio/outbound.raw.ulaw`);

    const metadataPath = `calls/${params.callId}/audio/metadata.json`;
    const metadata = Buffer.from(
      JSON.stringify(
        {
          format: "audio/x-mulaw",
          sampleRate: 8000,
          channels: 1,
          inboundBytes: Buffer.concat(this.inbound).length,
          outboundBytes: Buffer.concat(this.outbound).length,
          note: "Inbound and outbound tracks are stored separately to preserve raw call audio."
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
}
