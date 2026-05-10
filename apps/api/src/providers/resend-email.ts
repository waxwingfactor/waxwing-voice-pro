import { Resend } from "resend";
import type { ClientProfile, CallSnapshot } from "@waxwing/core";

export class ResendEmailProvider {
  private readonly resend?: Resend;

  constructor(
    private readonly params: {
      apiKey?: string;
      from: string;
      replyTo?: string;
      ownerEmail?: string;
    }
  ) {
    this.resend = params.apiKey ? new Resend(params.apiKey) : undefined;
  }

  async sendPostCallEmail(params: {
    client: ClientProfile;
    call: CallSnapshot;
    summary: string;
    transcriptText: string;
    audioUrls: string[];
  }): Promise<{ id?: string; recipients: string[]; subject: string }> {
    const recipients = [
      ...params.client.managerEmails,
      ...params.client.ownerNotificationEmails,
      ...(this.params.ownerEmail ? [this.params.ownerEmail] : [])
    ].filter(Boolean);

    const subject = `New leasing call: ${params.call.outcome ?? "completed"} (${params.call.id})`;
    const html = renderPostCallHtml(params);

    if (!this.resend) {
      return { recipients, subject };
    }

    const result = await this.resend.emails.send(
      {
        from: this.params.from,
        to: recipients,
        subject,
        html,
        replyTo: this.params.replyTo,
        tags: [{ name: "call_id", value: params.call.id.slice(0, 256) }]
      },
      {
        idempotencyKey: `post-call-${params.call.id}`
      }
    );

    if (result.error) throw result.error;
    return { id: result.data?.id, recipients, subject };
  }
}

function renderPostCallHtml(params: {
  client: ClientProfile;
  call: CallSnapshot;
  summary: string;
  transcriptText: string;
  audioUrls: string[];
}): string {
  const leadRows = Object.entries(params.call.lead)
    .map(([key, value]) => `<tr><td>${escapeHtml(key)}</td><td>${escapeHtml(String(value))}</td></tr>`)
    .join("");
  const audioLinks = params.audioUrls
    .map((url, index) => `<li><a href="${escapeHtml(url)}">Raw audio file ${index + 1}</a></li>`)
    .join("");

  return `
    <h1>New leasing call</h1>
    <p><strong>Client:</strong> ${escapeHtml(params.client.name)}</p>
    <p><strong>Call ID:</strong> ${escapeHtml(params.call.id)}</p>
    <p><strong>Outcome:</strong> ${escapeHtml(params.call.outcome ?? "unknown")}</p>
    <h2>Summary</h2>
    <p>${escapeHtml(params.summary)}</p>
    <h2>Captured information</h2>
    <table>${leadRows}</table>
    <h2>Raw audio</h2>
    <ul>${audioLinks}</ul>
    <h2>Transcript</h2>
    <pre>${escapeHtml(params.transcriptText)}</pre>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
