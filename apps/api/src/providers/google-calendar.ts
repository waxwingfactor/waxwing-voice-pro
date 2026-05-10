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

  getAuthorizationUrl(state?: string): string | null {
    if (!this.oauth2) return null;
    return this.oauth2.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: true,
      state,
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
    maxSlots?: number;
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
    const cursor = roundUpToNextHalfHour(params.timeMin);
    const maxSlots = params.maxSlots ?? 10;
    while (cursor < params.timeMax && slots.length < maxSlots) {
      const end = new Date(cursor.getTime() + params.durationMinutes * 60_000);
      const localStartMinute = getLocalMinuteOfDay(cursor, params.timezone);
      const localEndMinute = getLocalMinuteOfDay(end, params.timezone);
      const isBusinessHour = localStartMinute >= 9 * 60 && localEndMinute <= 17 * 60;
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

function roundUpToNextHalfHour(date: Date): Date {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  const minutes = rounded.getMinutes();
  const remainder = minutes % 30;
  if (remainder !== 0) {
    rounded.setMinutes(minutes + (30 - remainder));
  }
  return rounded;
}

function getLocalMinuteOfDay(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23"
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  const hour = parts.hour ? Number(parts.hour) : date.getUTCHours();
  const minute = parts.minute ? Number(parts.minute) : date.getUTCMinutes();
  return hour * 60 + minute;
}
