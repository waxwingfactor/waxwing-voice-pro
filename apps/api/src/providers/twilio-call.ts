import twilio from "twilio";
import type { TransferReason } from "@waxwing/core";

export class TwilioCallProvider {
  private readonly client?: ReturnType<typeof twilio>;

  constructor(params: { accountSid?: string; authToken?: string }) {
    this.client =
      params.accountSid && params.authToken
        ? twilio(params.accountSid, params.authToken)
        : undefined;
  }

  async transfer(params: {
    callSid: string;
    to: string;
    reason: TransferReason;
  }): Promise<void> {
    if (!this.client) return;
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Dial>${escapeXml(
      params.to
    )}</Dial></Response>`;
    await this.client.calls(params.callSid).update({ twiml });
  }

  async endCall(callSid: string): Promise<void> {
    if (!this.client) return;
    await this.client.calls(callSid).update({ status: "completed" });
  }
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
