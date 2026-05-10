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

  async sendShowingConfirmationEmail(params: {
    client: ClientProfile;
    call: CallSnapshot;
  }): Promise<{ id?: string; recipients: string[]; subject: string } | null> {
    const recipient = params.call.lead.callerEmail;
    const showingTime = params.call.lead.requestedShowingTime;
    if (!recipient || !showingTime || !isIsoDate(showingTime)) return null;

    const subject = `Showing confirmed: ${params.call.lead.propertyAddress ?? "your property tour"}`;
    const html = renderShowingConfirmationHtml(params);
    if (!this.resend) {
      return { recipients: [recipient], subject };
    }

    const result = await this.resend.emails.send(
      {
        from: this.params.from,
        to: [recipient],
        subject,
        html,
        replyTo: this.params.replyTo,
        tags: [{ name: "call_id", value: params.call.id.slice(0, 256) }]
      },
      {
        idempotencyKey: `showing-confirmation-${params.call.id}`
      }
    );

    if (result.error) throw result.error;
    return { id: result.data?.id, recipients: [recipient], subject };
  }
}

function renderShowingConfirmationHtml(params: {
  client: ClientProfile;
  call: CallSnapshot;
}): string {
  const lead = params.call.lead;
  const showingTime = lead.requestedShowingTime
    ? formatDate(lead.requestedShowingTime)
    : "the scheduled time";
  const property = lead.propertyAddress ?? lead.propertyNameRaw ?? "the property";

  return `
    <!doctype html>
    <html>
      <body style="margin:0;padding:0;background:#F4F7F8;color:#172026;font-family:Inter,Arial,sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F4F7F8;">
          <tr>
            <td align="center" style="padding:28px 16px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#FFFFFF;border:1px solid #D9E0E6;border-radius:14px;overflow:hidden;">
                <tr>
                  <td style="padding:28px 30px;background:#102620;color:#F6FBF8;">
                    <div style="font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#9FE0C8;">Waxwing Voice Pro</div>
                    <h1 style="margin:10px 0 6px;font-size:26px;line-height:1.15;color:#FFFFFF;">Showing confirmed</h1>
                    <p style="margin:0;color:#D8EEE7;font-size:15px;">${escapeHtml(params.client.name)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 30px;">
                    <p style="margin:0 0 16px;color:#172026;font-size:16px;line-height:1.55;">
                      Hi ${escapeHtml(lead.callerName ?? "there")}, your showing has been scheduled.
                    </p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #D9E0E6;border-radius:10px;overflow:hidden;">
                      <tr>
                        <td style="padding:12px 14px;border-bottom:1px solid #E4ECE9;color:#5E6F68;font-size:12px;font-weight:700;text-transform:uppercase;">Property</td>
                        <td style="padding:12px 14px;border-bottom:1px solid #E4ECE9;color:#172026;font-size:14px;font-weight:700;text-align:right;">${escapeHtml(property)}</td>
                      </tr>
                      <tr>
                        <td style="padding:12px 14px;color:#5E6F68;font-size:12px;font-weight:700;text-transform:uppercase;">Time</td>
                        <td style="padding:12px 14px;color:#172026;font-size:14px;font-weight:700;text-align:right;">${escapeHtml(showingTime)}</td>
                      </tr>
                    </table>
                    <p style="margin:18px 0 0;color:#66737F;font-size:14px;line-height:1.5;">
                      If you need to make a change, please reply to this email or contact the property manager.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function renderPostCallHtml(params: {
  client: ClientProfile;
  call: CallSnapshot;
  summary: string;
  transcriptText: string;
  audioUrls: string[];
}): string {
  const leadRows = capturedInfoRows(params.call)
    .map(
      ({ label, value }) => `
        <tr>
          <td style="padding:12px 14px;border-bottom:1px solid #E4ECE9;color:#5E6F68;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;">${escapeHtml(label)}</td>
          <td style="padding:12px 14px;border-bottom:1px solid #E4ECE9;color:#172026;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(value)}</td>
        </tr>`
    )
    .join("");
  const audioLinks = params.audioUrls
    .slice(0, 1)
    .map(
      (url) => `
        <a href="${escapeHtml(url)}" style="display:inline-block;margin:0 8px 8px 0;padding:10px 14px;border-radius:8px;background:#EAF7F1;color:#0B5F4B;font-size:13px;font-weight:700;text-decoration:none;">
          Conversation recording
        </a>`
    )
    .join("");
  const transcript = params.call.transcript
    .map((turn) => renderTranscriptTurn(turn))
    .join("");
  const outcome = params.call.outcome ?? params.call.status;
  const qualification = params.call.qualification?.qualifiedToApply ?? "not completed";
  const property = params.call.lead.propertyAddress ?? params.call.lead.propertyNameRaw ?? "Not captured";
  const caller = params.call.lead.callerName ?? "Unknown caller";

  return `
    <!doctype html>
    <html>
      <body style="margin:0;padding:0;background:#F4F7F8;color:#172026;font-family:Inter,Arial,sans-serif;">
        <div style="display:none;max-height:0;overflow:hidden;">
          New leasing call for ${escapeHtml(params.client.name)} from ${escapeHtml(caller)}.
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F4F7F8;">
          <tr>
            <td align="center" style="padding:28px 16px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:760px;background:#FFFFFF;border:1px solid #D9E0E6;border-radius:14px;overflow:hidden;">
                <tr>
                  <td style="padding:28px 30px;background:#102620;color:#F6FBF8;">
                    <div style="font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#9FE0C8;">Waxwing Voice Pro</div>
                    <h1 style="margin:10px 0 6px;font-size:28px;line-height:1.15;color:#FFFFFF;">New leasing call</h1>
                    <p style="margin:0;color:#D8EEE7;font-size:15px;">${escapeHtml(params.client.name)} · ${escapeHtml(formatDate(params.call.startedAt))}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 30px 8px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        ${renderMetric("Caller", caller)}
                        ${renderMetric("Outcome", outcome)}
                        ${renderMetric("Qualified", qualification)}
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 30px 0;">
                    <div style="padding:18px;border:1px solid #B9DED1;border-radius:10px;background:#EEF9F4;">
                      <div style="margin-bottom:6px;color:#0B5F4B;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;">Call summary</div>
                      <p style="margin:0;color:#172026;font-size:16px;line-height:1.55;">${escapeHtml(params.summary)}</p>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 30px 0;">
                    <h2 style="margin:0 0 10px;font-size:18px;color:#172026;">Captured information</h2>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #D9E0E6;border-radius:10px;overflow:hidden;">
                      ${leadRows || emptyRow("No structured fields were captured.")}
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 30px 0;">
                    <h2 style="margin:0 0 10px;font-size:18px;color:#172026;">Recording files</h2>
                    <div style="padding:16px;border:1px solid #D9E0E6;border-radius:10px;background:#FBFDFD;">
                      ${audioLinks || `<span style="color:#66737F;font-size:14px;">No audio files were attached to this call package.</span>`}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 30px 28px;">
                    <h2 style="margin:0 0 10px;font-size:18px;color:#172026;">Transcript</h2>
                    <div style="padding:16px;border:1px solid #D9E0E6;border-radius:10px;background:#FBFDFD;">
                      ${transcript || fallbackTranscript(params.transcriptText)}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 30px;background:#F0F5F3;color:#66737F;font-size:12px;line-height:1.5;">
                    <strong style="color:#172026;">Call ID:</strong> ${escapeHtml(params.call.id)}<br />
                    <strong style="color:#172026;">Property:</strong> ${escapeHtml(String(property))}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function renderMetric(label: string, value: string): string {
  return `
    <td width="33.33%" style="padding:0 8px 10px 0;">
      <div style="min-height:72px;padding:14px;border:1px solid #D9E0E6;border-radius:10px;background:#FBFDFD;">
        <div style="margin-bottom:8px;color:#66737F;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;">${escapeHtml(label)}</div>
        <div style="color:#172026;font-size:17px;font-weight:800;line-height:1.25;">${escapeHtml(value)}</div>
      </div>
    </td>`;
}

function capturedInfoRows(call: CallSnapshot): Array<{ label: string; value: string }> {
  const lead = call.lead;
  const rows = [
    ["Caller name", lead.callerName],
    ["Phone", lead.callerPhone],
    ["Email", lead.callerEmail],
    ["Property", lead.propertyAddress ?? lead.propertyNameRaw],
    ["Monthly rent", moneyValue(lead.monthlyRentCents)],
    ["Adults", lead.adultCount],
    ["Move-in date", lead.desiredMoveInDate],
    ["Length of stay", lead.desiredLengthOfStay],
    ["Showing requested", booleanValue(lead.showingRequested)],
    ["Requested showing time", lead.requestedShowingTime],
    ["Callback requested", booleanValue(lead.callbackRequested)],
    ["Application encouraged", booleanValue(lead.applicationEncouraged)],
    ["Qualified to apply", call.qualification?.qualifiedToApply],
    ["Credit over 600", booleanValue(call.qualification?.creditOver600)],
    ["Income meets 3x rent", booleanValue(call.qualification?.incomeMeets3xRent)],
    ["Income threshold", moneyValue(call.qualification?.incomeThresholdCents)]
  ];

  return rows
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([label, value]) => ({ label: String(label), value: String(value) }));
}

function renderTranscriptTurn(turn: CallSnapshot["transcript"][number]): string {
  const isAgent = turn.speaker === "agent";
  const speaker = turn.speaker === "agent" ? "Morgan" : turn.speaker === "caller" ? "Caller" : "System";
  return `
    <div style="margin-bottom:10px;text-align:${isAgent ? "right" : "left"};">
      <div style="display:inline-block;max-width:86%;padding:11px 13px;border:1px solid ${isAgent ? "#B9DED1" : "#D9E0E6"};border-radius:10px;background:${isAgent ? "#EEF9F4" : "#FFFFFF"};text-align:left;">
        <div style="margin-bottom:5px;color:${isAgent ? "#0B5F4B" : "#66737F"};font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;">${escapeHtml(speaker)} · ${escapeHtml(formatDate(turn.at))}</div>
        <div style="color:#172026;font-size:14px;line-height:1.5;">${escapeHtml(turn.text)}</div>
      </div>
    </div>`;
}

function fallbackTranscript(transcriptText: string): string {
  return transcriptText
    ? `<pre style="margin:0;white-space:pre-wrap;color:#172026;font-size:13px;line-height:1.5;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(transcriptText)}</pre>`
    : `<span style="color:#66737F;font-size:14px;">No transcript was captured.</span>`;
}

function emptyRow(message: string): string {
  return `<tr><td style="padding:14px;color:#66737F;font-size:14px;">${escapeHtml(message)}</td></tr>`;
}

function booleanValue(value: boolean | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value ? "Yes" : "No";
}

function moneyValue(value: number | undefined): string | undefined {
  if (typeof value !== "number") return undefined;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value / 100);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function isIsoDate(value: string): boolean {
  return Number.isFinite(new Date(value).getTime());
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
