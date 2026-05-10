import type { CallSnapshot, ClientProfile } from "@waxwing/core";

export class MiroProvider {
  constructor(private readonly params: { defaultBoardId?: string }) {}

  async createLeadCard(params: {
    accessToken?: string;
    boardId?: string;
    client: ClientProfile;
    call: CallSnapshot;
    summary: string;
    audioUrls: string[];
  }): Promise<{ boardId: string; itemId?: string }> {
    const boardId = params.boardId ?? this.params.defaultBoardId;
    if (!params.accessToken || !boardId) {
      return { boardId: boardId ?? "not-configured" };
    }

    const fillColor =
      params.call.qualification?.qualifiedToApply === "yes"
        ? "light_green"
        : params.call.qualification?.qualifiedToApply === "debatable"
          ? "yellow"
          : "light_red";

    const response = await fetch(`https://api.miro.com/v2/boards/${boardId}/sticky_notes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        data: {
          content: `<p><strong>${escapeHtml(params.client.name)}</strong></p><p>${escapeHtml(
            params.summary
          )}</p><p>Call: ${escapeHtml(params.call.id)}</p>`,
          shape: "square"
        },
        style: {
          fillColor,
          textAlign: "left",
          textAlignVertical: "top"
        },
        position: { x: 0, y: 0 }
      })
    });

    if (!response.ok) {
      throw new Error(`Miro create sticky failed: ${response.status} ${await response.text()}`);
    }
    const data = (await response.json()) as { id?: string };
    return { boardId, itemId: data.id };
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
