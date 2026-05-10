import type { CallSnapshot, ClientProfile } from "@waxwing/core";

export class MiroProvider {
  private refreshedAccessToken?: string;

  constructor(
    private readonly params: {
      defaultBoardId?: string;
      accessToken?: string;
      refreshToken?: string;
      clientId?: string;
      clientSecret?: string;
    }
  ) {}

  async createLeadCard(params: {
    accessToken?: string;
    boardId?: string;
    client: ClientProfile;
    call: CallSnapshot;
    summary: string;
    audioUrls: string[];
  }): Promise<{ boardId: string; itemId?: string }> {
    const boardId = params.boardId ?? this.params.defaultBoardId;
    const accessToken = params.accessToken ?? (await this.getAccessToken());
    if (!accessToken || !boardId) {
      return { boardId: boardId ?? "not-configured" };
    }

    const origin = layoutOrigin(params.call);
    const created: Array<{ id?: string }> = [];
    const theme = callTheme(params.call);

    created.push(
      await this.createShape(accessToken, boardId, {
        content: `<strong>${escapeHtml(params.client.name)}</strong><br/>${escapeHtml(
          headline(params.call)
        )}`,
        fillColor: "#102620",
        textColor: "#ffffff",
        x: origin.x,
        y: origin.y,
        width: 760,
        height: 110
      })
    );

    created.push(
      await this.createSticky(accessToken, boardId, {
        content: `<p><strong>Summary</strong></p><p>${escapeHtml(params.summary)}</p><p><strong>Call ID:</strong><br/>${escapeHtml(
          params.call.id
        )}</p>`,
        fillColor: "light_green",
        x: origin.x - 255,
        y: origin.y + 210,
        width: 310
      })
    );

    created.push(
      await this.createSticky(accessToken, boardId, {
        content: `<p><strong>${escapeHtml(theme.title)}</strong></p><p>${escapeHtml(
          theme.message
        )}</p><p>${escapeHtml(nextAction(params.call))}</p>`,
        fillColor: theme.stickyColor,
        x: origin.x + 80,
        y: origin.y + 210,
        width: 310
      })
    );

    created.push(
      await this.createSticky(accessToken, boardId, {
        content: capturedInfoHtml(params.call),
        fillColor: "light_blue",
        x: origin.x + 415,
        y: origin.y + 210,
        width: 310
      })
    );

    created.push(
      await this.createText(accessToken, boardId, {
        content: audioLinksHtml(params.audioUrls.slice(0, 1)),
        x: origin.x + 415,
        y: origin.y + 430,
        width: 310
      })
    );

    created.push(
      await this.createShape(accessToken, boardId, {
        content: "<strong>Transcript</strong>",
        fillColor: "#F4F7F8",
        textColor: "#102620",
        x: origin.x,
        y: origin.y + 520,
        width: 980,
        height: 56
      })
    );

    const transcriptChunks = transcriptHtmlChunks(params.call);
    for (const [index, chunk] of transcriptChunks.entries()) {
      created.push(
        await this.createShape(accessToken, boardId, {
          content: chunk,
          x: origin.x,
          y: origin.y + 625 + index * 365,
          width: 980,
          height: 310,
          fillColor: "#FFFFFF",
          textColor: "#172026",
          fontSize: "14",
          textAlignVertical: "top"
        })
      );
    }

    return { boardId, itemId: created.find((item) => item.id)?.id };
  }

  private async getAccessToken(): Promise<string | undefined> {
    if (this.refreshedAccessToken) return this.refreshedAccessToken;
    if (this.params.accessToken) return this.params.accessToken;
    if (!this.params.refreshToken || !this.params.clientId || !this.params.clientSecret) {
      return undefined;
    }

    const token = await refreshMiroAccessToken({
      clientId: this.params.clientId,
      clientSecret: this.params.clientSecret,
      refreshToken: this.params.refreshToken
    });
    this.refreshedAccessToken = token.accessToken;
    return this.refreshedAccessToken;
  }

  private async createSticky(
    accessToken: string,
    boardId: string,
    params: {
      content: string;
      fillColor: string;
      x: number;
      y: number;
      width: number;
    }
  ): Promise<{ id?: string }> {
    return this.miroRequest(accessToken, boardId, "sticky_notes", {
      data: {
        content: truncateHtml(params.content, 5800),
        shape: "rectangle"
      },
      style: {
        fillColor: params.fillColor,
        textAlign: "left",
        textAlignVertical: "top"
      },
      position: { x: params.x, y: params.y },
      geometry: { width: params.width }
    });
  }

  private async createText(
    accessToken: string,
    boardId: string,
    params: { content: string; x: number; y: number; width: number }
  ): Promise<{ id?: string }> {
    return this.miroRequest(accessToken, boardId, "texts", {
      data: { content: truncateHtml(params.content, 5800) },
      style: {
        fontSize: "16",
        textAlign: "left"
      },
      position: { x: params.x, y: params.y },
      geometry: { width: params.width }
    });
  }

  private async createShape(
    accessToken: string,
    boardId: string,
    params: {
      content: string;
      fillColor: string;
      textColor: string;
      x: number;
      y: number;
      width: number;
      height: number;
      fontSize?: string;
      textAlignVertical?: "top" | "middle" | "bottom";
    }
  ): Promise<{ id?: string }> {
    return this.miroRequest(accessToken, boardId, "shapes", {
      data: {
        content: truncateHtml(params.content, 5800),
        shape: "round_rectangle"
      },
      style: {
        fillColor: params.fillColor,
        fillOpacity: "1.0",
        color: params.textColor,
        fontSize: params.fontSize ?? "22",
        textAlign: "left",
        textAlignVertical: params.textAlignVertical ?? "middle"
      },
      position: { x: params.x, y: params.y },
      geometry: { width: params.width, height: params.height }
    });
  }

  private async miroRequest(
    accessToken: string,
    boardId: string,
    itemType: "sticky_notes" | "texts" | "shapes",
    body: Record<string, unknown>
  ): Promise<{ id?: string }> {
    const response = await fetch(
      `https://api.miro.com/v2/boards/${encodeURIComponent(boardId)}/${itemType}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      throw new Error(
        `Miro create ${itemType} failed: ${response.status} ${await response.text()}`
      );
    }
    return (await response.json()) as { id?: string };
  }
}

export async function exchangeMiroCode(params: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<MiroTokenResponse> {
  return fetchMiroToken({
    grant_type: "authorization_code",
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    code: params.code
  });
}

export async function refreshMiroAccessToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<MiroTokenResponse> {
  return fetchMiroToken({
    grant_type: "refresh_token",
    client_id: params.clientId,
    client_secret: params.clientSecret,
    refresh_token: params.refreshToken
  });
}

interface MiroTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
  tokenType?: string;
}

async function fetchMiroToken(params: Record<string, string>): Promise<MiroTokenResponse> {
  const response = await fetch("https://api.miro.com/v1/oauth/token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams(params)
  });

  if (!response.ok) {
    throw new Error(`Miro token request failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  return {
    accessToken: String(data.access_token ?? ""),
    refreshToken: typeof data.refresh_token === "string" ? data.refresh_token : undefined,
    expiresIn: typeof data.expires_in === "number" ? data.expires_in : undefined,
    scope: typeof data.scope === "string" ? data.scope : undefined,
    tokenType: typeof data.token_type === "string" ? data.token_type : undefined
  };
}

function layoutOrigin(call: CallSnapshot): { x: number; y: number } {
  const numeric = Array.from(call.id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return {
    x: (numeric % 4) * 1280,
    y: (Math.floor(numeric / 4) % 8) * 2600
  };
}

function headline(call: CallSnapshot): string {
  const name = call.lead.callerName ?? "Unknown caller";
  const property = call.lead.propertyAddress ?? call.lead.propertyNameRaw ?? "Property not captured";
  return `${name} - ${property}`;
}

function callTheme(call: CallSnapshot): { title: string; message: string; stickyColor: string } {
  const status = call.qualification?.qualifiedToApply;
  if (status === "yes") {
    return {
      title: "Qualified lead",
      message: "Credit and income criteria were met.",
      stickyColor: "light_green"
    };
  }
  if (status === "debatable") {
    return {
      title: "Needs review",
      message: "The caller may need a co-signer, increased deposit, or manager follow-up.",
      stickyColor: "yellow"
    };
  }
  if (status === "no") {
    return {
      title: "Not qualified yet",
      message: "The caller did not meet current qualification criteria.",
      stickyColor: "light_red"
    };
  }
  return {
    title: "Call captured",
    message: "Qualification was not completed on this call.",
    stickyColor: "gray"
  };
}

function nextAction(call: CallSnapshot): string {
  if (call.outcome === "showing_booked") return "Next action: Showing booked. Review calendar.";
  if (call.lead.showingRequested) return "Next action: Coordinate showing details.";
  if (call.lead.callbackRequested) return "Next action: Call the prospect back.";
  if (call.outcome === "transferred") return "Next action: Review transferred call outcome.";
  return "Next action: Review call package.";
}

function capturedInfoHtml(call: CallSnapshot): string {
  const rows = [
    ["Name", call.lead.callerName],
    ["Phone", call.lead.callerPhone],
    ["Email", call.lead.callerEmail],
    ["Move-in", call.lead.desiredMoveInDate],
    ["Stay length", call.lead.desiredLengthOfStay],
    ["Adults", call.lead.adultCount],
    ["Qualification", call.qualification?.qualifiedToApply],
    ["Income threshold", money(call.qualification?.incomeThresholdCents)]
  ]
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([label, value]) => `<p><strong>${escapeHtml(String(label))}:</strong> ${escapeHtml(String(value))}</p>`)
    .join("");

  return `<p><strong>Captured info</strong></p>${rows || "<p>No structured fields captured.</p>"}`;
}

function transcriptHtmlChunks(call: CallSnapshot): string[] {
  if (call.transcript.length === 0) return ["<p>No transcript captured.</p>"];

  const chunks: string[] = [];
  let current = "";
  let turnsInChunk = 0;

  for (const turn of call.transcript) {
    const rendered = `<p><strong>${speakerLabel(turn.speaker)}:</strong> ${escapeHtml(turn.text)}</p>`;
    const wouldBeTooLong = (current + rendered).length > 950;
    const wouldHaveTooManyTurns = turnsInChunk >= 4;
    if (current && (wouldBeTooLong || wouldHaveTooManyTurns)) {
      chunks.push(wrapTranscriptChunk(current, chunks.length + 1));
      current = "";
      turnsInChunk = 0;
    }
    current += rendered;
    turnsInChunk += 1;
  }

  if (current) chunks.push(wrapTranscriptChunk(current, chunks.length + 1));
  return chunks;
}

function audioLinksHtml(audioUrls: string[]): string {
  const links = audioUrls
    .slice(0, 1)
    .map(
      (url) =>
        `<p><a href="${escapeHtml(url)}">Conversation recording</a></p>`
    )
    .join("");
  return `<p><strong>Audio</strong></p>${links || "<p>No audio link available.</p>"}`;
}

function wrapTranscriptChunk(content: string, chunkNumber: number): string {
  return `<p><strong>Transcript ${chunkNumber}</strong></p>${content}`;
}

function speakerLabel(speaker: CallSnapshot["transcript"][number]["speaker"]): string {
  if (speaker === "agent") return "Agent";
  if (speaker === "caller") return "Caller";
  return "System";
}

function money(value?: number): string | undefined {
  if (typeof value !== "number") return undefined;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value / 100);
}

function truncateHtml(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 20)}...` : value;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
