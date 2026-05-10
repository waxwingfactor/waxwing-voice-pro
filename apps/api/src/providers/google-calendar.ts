import { google, calendar_v3 } from "googleapis";
import type { ShowingSlot } from "@waxwing/core";

export class GoogleCalendarProvider {
  private readonly oauth2?: InstanceType<typeof google.auth.OAuth2>;

  constructor(
    private readonly params: {
      clientId?: string;
      clientSecret?: string;
      redirectUri?: string;
    }
  ) {
    this.oauth2 =
      params.clientId && params.clientSecret && params.redirectUri
        ? new google.auth.OAuth2(params.clientId, params.clientSecret, params.redirectUri)
        : undefined;
  }

  getAuthorizationUrl(): string | null {
    if (!this.oauth2) return null;
    return this.oauth2.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/calendar.freebusy"
      ]
    });
  }

  async exchangeCode(code: string): Promise<Record<string, unknown>> {
    if (!this.oauth2) throw new Error("Google OAuth is not configured.");
    const { tokens } = await this.oauth2.getToken(code);
    return tokens as Record<string, unknown>;
  }

  async findAvailableSlots(params: {
    calendarId: string;
    refreshToken?: string;
    timeMin: Date;
    timeMax: Date;
    durationMinutes: number;
    timezone: string;
  }): Promise<ShowingSlot[]> {
    if (!this.oauth2 || !params.refreshToken) {
      return [];
    }

    const calendar = this.calendar(params.refreshToken);
    const freebusy = await calendar.freebusy.query({
      requestBody: {
        timeMin: params.timeMin.toISOString(),
        timeMax: params.timeMax.toISOString(),
        timeZone: params.timezone,
        items: [{ id: params.calendarId }]
      }
    });

    const busy =
      freebusy.data.calendars?.[params.calendarId]?.busy?.map((slot) => ({
        start: new Date(slot.start ?? ""),
        end: new Date(slot.end ?? "")
      })) ?? [];

    const slots: ShowingSlot[] = [];
    const cursor = new Date(params.timeMin);
    cursor.setMinutes(0, 0, 0);
    while (cursor < params.timeMax && slots.length < 5) {
      const end = new Date(cursor.getTime() + params.durationMinutes * 60_000);
      const hour = cursor.getHours();
      const isBusinessHour = hour >= 9 && hour <= 16;
      const overlaps = busy.some((item) => cursor < item.end && end > item.start);
      if (isBusinessHour && !overlaps && end <= params.timeMax) {
        slots.push({
          calendarId: params.calendarId,
          start: cursor.toISOString(),
          end: end.toISOString()
        });
      }
      cursor.setMinutes(cursor.getMinutes() + 30);
    }
    return slots;
  }

  async bookShowing(params: {
    calendarId: string;
    refreshToken?: string;
    slot: ShowingSlot;
    summary: string;
    description: string;
  }): Promise<{ eventId: string; htmlLink?: string }> {
    if (!this.oauth2 || !params.refreshToken) {
      throw new Error("Google Calendar is not connected for this client.");
    }

    const calendar = this.calendar(params.refreshToken);
    const event: calendar_v3.Schema$Event = {
      summary: params.summary,
      description: params.description,
      start: { dateTime: params.slot.start },
      end: { dateTime: params.slot.end }
    };
    const result = await calendar.events.insert({
      calendarId: params.calendarId,
      requestBody: event,
      sendUpdates: "none"
    });

    return {
      eventId: result.data.id ?? "",
      htmlLink: result.data.htmlLink ?? undefined
    };
  }

  private calendar(refreshToken: string): calendar_v3.Calendar {
    if (!this.oauth2) throw new Error("Google OAuth is not configured.");
    this.oauth2.setCredentials({ refresh_token: refreshToken });
    return google.calendar({ version: "v3", auth: this.oauth2 });
  }
}
