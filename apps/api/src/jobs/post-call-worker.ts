import type { AppRepository, ArtifactStorage } from "@waxwing/db";
import type { CallSnapshot, ClientProfile } from "@waxwing/core";
import type { ResendEmailProvider } from "../providers/resend-email.js";
import type { MiroProvider } from "../providers/miro.js";

export class PostCallWorker {
  constructor(
    private readonly deps: {
      repository: AppRepository;
      storage: ArtifactStorage;
      email: ResendEmailProvider;
      miro: MiroProvider;
      miroAccessToken?: string;
    }
  ) {}

  async finalize(params: {
    call: CallSnapshot;
    client: ClientProfile;
    audioPaths: string[];
  }): Promise<void> {
    const audioUrls = await Promise.all(
      params.audioPaths.map((path) => this.deps.storage.createSignedUrl(path))
    );
    const transcriptText = params.call.transcript
      .map((turn) => `[${turn.at}] ${turn.speaker}: ${turn.text}`)
      .join("\n");
    const summary = buildSummary(params.call);

    try {
      const result = await this.deps.email.sendPostCallEmail({
        client: params.client,
        call: params.call,
        summary,
        transcriptText,
        audioUrls
      });
      await this.deps.repository.recordEmail({
        callId: params.call.id,
        resendEmailId: result.id,
        recipients: result.recipients,
        subject: result.subject,
        status: "sent"
      });
    } catch (error) {
      await this.deps.repository.recordEmail({
        callId: params.call.id,
        recipients: [...params.client.managerEmails, ...params.client.ownerNotificationEmails],
        subject: `New leasing call: ${params.call.id}`,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error)
      });
    }

    try {
      const result = await this.deps.miro.createLeadCard({
        accessToken: this.deps.miroAccessToken,
        client: params.client,
        call: params.call,
        summary,
        audioUrls
      });
      await this.deps.repository.recordMiroExport({
        callId: params.call.id,
        boardId: result.boardId,
        itemId: result.itemId,
        status: result.itemId ? "synced" : "failed",
        errorMessage: result.itemId ? undefined : "Miro access token or board ID not configured."
      });
    } catch (error) {
      await this.deps.repository.recordMiroExport({
        callId: params.call.id,
        boardId: "unknown",
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

function buildSummary(call: CallSnapshot): string {
  const name = call.lead.callerName ? `${call.lead.callerName} ` : "Caller ";
  const property = call.lead.propertyAddress ?? call.propertyId ?? "an unspecified property";
  const qualification = call.qualification?.qualifiedToApply ?? "not completed";
  const showing = call.lead.showingRequested ? "Showing was requested." : "No showing requested.";
  return `${name}called about ${property}. Qualification status: ${qualification}. ${showing}`;
}
