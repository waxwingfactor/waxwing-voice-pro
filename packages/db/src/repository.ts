import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  CallSnapshot,
  ClientProfile,
  PropertyRecord,
  QualificationResult,
  ShowingSlot
} from "@waxwing/core";

export interface CallAudioFileInput {
  callId: string;
  kind: "inbound_raw_ulaw" | "outbound_raw_ulaw" | "mixed_wav" | "metadata";
  storagePath: string;
  mimeType: string;
  byteSize: number;
}

export interface PostCallPackage {
  callId: string;
  summary: string;
  transcriptText: string;
  audioUrls: string[];
  lead: Record<string, unknown>;
  qualification?: QualificationResult;
}

export interface CalendarConnection {
  clientId: string;
  calendarId: string;
  googleAccountEmail: string;
  encryptedRefreshToken: string;
  scopes: string[];
}

export interface DashboardRecentCall {
  id: string;
  startedAt: string;
  status: string;
  outcome?: string;
  callerName?: string;
  callerPhone?: string;
  propertyAddress?: string;
  qualificationStatus?: string;
  showingRequested: boolean;
  callbackRequested: boolean;
  complianceEventCount: number;
}

export interface DashboardRepositorySnapshot {
  client: ClientProfile;
  metrics: {
    callsToday: number;
    qualifiedLeadsToday: number;
    showingsBookedToday: number;
    followUpsToday: number;
    complianceEventsToday: number;
  };
  recentCalls: DashboardRecentCall[];
  counts: {
    activeProperties: number;
    calendarConnections: number;
  };
  calendarConnections: Array<{
    calendarId: string;
    googleAccountEmail: string;
    connectedAt: string;
  }>;
}

export interface AppRepository {
  getClientBySlug(slug: string): Promise<ClientProfile | null>;
  getDashboardSnapshot(clientSlug: string): Promise<DashboardRepositorySnapshot | null>;
  listActiveProperties(clientId: string): Promise<PropertyRecord[]>;
  getProperty(propertyId: string): Promise<PropertyRecord | null>;
  getCallIdByTwilioSid(twilioCallSid: string): Promise<string | null>;
  upsertCalendarConnection(input: CalendarConnection): Promise<void>;
  getCalendarConnection(
    clientId: string,
    calendarId: string
  ): Promise<CalendarConnection | null>;
  getDefaultCalendarConnection(clientId: string): Promise<CalendarConnection | null>;
  createCall(snapshot: CallSnapshot): Promise<void>;
  updateCall(snapshot: CallSnapshot): Promise<void>;
  appendCallEvent(input: {
    callId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<void>;
  recordCallAudio(input: CallAudioFileInput): Promise<void>;
  recordShowing(input: {
    callId: string;
    propertyId: string;
    calendarEventId: string;
    slot: ShowingSlot;
    status: "booked" | "requested" | "failed";
  }): Promise<void>;
  recordEmail(input: {
    callId: string;
    resendEmailId?: string;
    recipients: string[];
    subject: string;
    status: "sent" | "failed";
    errorMessage?: string;
  }): Promise<void>;
  recordMiroExport(input: {
    callId: string;
    boardId: string;
    itemId?: string;
    status: "synced" | "failed";
    errorMessage?: string;
  }): Promise<void>;
}

export class SupabaseAppRepository implements AppRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  static fromEnv(params: { supabaseUrl: string; serviceRoleKey: string }): SupabaseAppRepository {
    return new SupabaseAppRepository(
      createClient(params.supabaseUrl, params.serviceRoleKey, {
        auth: { persistSession: false }
      })
    );
  }

  async getClientBySlug(slug: string): Promise<ClientProfile | null> {
    const { data, error } = await this.supabase
      .from("clients")
      .select("*")
      .eq("slug", slug)
      .eq("active", true)
      .maybeSingle();

    if (error) throw error;
    return data ? mapClient(data) : null;
  }

  async getDashboardSnapshot(clientSlug: string): Promise<DashboardRepositorySnapshot | null> {
    const client = await this.getClientBySlug(clientSlug);
    if (!client) return null;

    const startOfToday = startOfTodayInTimezone(client.timezone).toISOString();
    const [{ data: calls, error: callsError }, propertiesCount, calendarConnections, showingsBooked] =
      await Promise.all([
        this.supabase
          .from("calls")
          .select("id, started_at, status, outcome, lead, qualification, compliance_events")
          .eq("client_id", client.id)
          .gte("started_at", startOfToday)
          .order("started_at", { ascending: false })
          .limit(500),
        this.countRows("properties", { client_id: client.id, active: true }),
        this.listCalendarConnections(client.id),
        this.countRows("showings", { status: "booked" }, "created_at", startOfToday)
      ]);

    if (callsError) throw callsError;

    const todayCalls = (calls ?? []) as Array<Record<string, any>>;
    const recentCalls = todayCalls.slice(0, 10).map(mapDashboardCall);
    const complianceEventsToday = todayCalls.reduce(
      (count, call) => count + complianceEventCount(call.compliance_events),
      0
    );
    const qualifiedLeadsToday = todayCalls.filter(
      (call) => call.qualification?.qualifiedToApply === "yes"
    ).length;
    const followUpsToday = todayCalls.filter((call) => {
      const lead = call.lead ?? {};
      return (
        lead.callbackRequested === true ||
        call.qualification?.needsHumanFollowUp === true ||
        call.status === "failed" ||
        call.outcome === "transferred"
      );
    }).length;

    return {
      client,
      metrics: {
        callsToday: todayCalls.length,
        qualifiedLeadsToday,
        showingsBookedToday: showingsBooked,
        followUpsToday,
        complianceEventsToday
      },
      recentCalls,
      counts: {
        activeProperties: propertiesCount,
        calendarConnections: calendarConnections.length
      },
      calendarConnections
    };
  }

  async listActiveProperties(clientId: string): Promise<PropertyRecord[]> {
    const { data, error } = await this.supabase
      .from("properties")
      .select("*")
      .eq("client_id", clientId)
      .eq("active", true)
      .order("city")
      .order("street_name");

    if (error) throw error;
    return (data ?? []).map(mapProperty);
  }

  async getProperty(propertyId: string): Promise<PropertyRecord | null> {
    const { data, error } = await this.supabase
      .from("properties")
      .select("*")
      .eq("id", propertyId)
      .maybeSingle();

    if (error) throw error;
    return data ? mapProperty(data) : null;
  }

  async getCallIdByTwilioSid(twilioCallSid: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from("calls")
      .select("id")
      .eq("twilio_call_sid", twilioCallSid)
      .maybeSingle();

    if (error) throw error;
    return data?.id ?? null;
  }

  async upsertCalendarConnection(input: CalendarConnection): Promise<void> {
    const { error } = await this.supabase.from("calendar_connections").upsert(
      {
        client_id: input.clientId,
        calendar_id: input.calendarId,
        google_account_email: input.googleAccountEmail,
        encrypted_refresh_token: input.encryptedRefreshToken,
        scopes: input.scopes,
        updated_at: new Date().toISOString()
      },
      { onConflict: "client_id,calendar_id" }
    );
    if (error) throw error;
  }

  async getCalendarConnection(
    clientId: string,
    calendarId: string
  ): Promise<CalendarConnection | null> {
    const { data, error } = await this.supabase
      .from("calendar_connections")
      .select("*")
      .eq("client_id", clientId)
      .eq("calendar_id", calendarId)
      .maybeSingle();

    if (error) throw error;
    return data
      ? {
          clientId: data.client_id,
          calendarId: data.calendar_id,
          googleAccountEmail: data.google_account_email,
          encryptedRefreshToken: data.encrypted_refresh_token,
          scopes: data.scopes ?? []
        }
      : null;
  }

  async getDefaultCalendarConnection(clientId: string): Promise<CalendarConnection | null> {
    const { data, error } = await this.supabase
      .from("calendar_connections")
      .select("*")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data
      ? {
          clientId: data.client_id,
          calendarId: data.calendar_id,
          googleAccountEmail: data.google_account_email,
          encryptedRefreshToken: data.encrypted_refresh_token,
          scopes: data.scopes ?? []
        }
      : null;
  }

  async createCall(snapshot: CallSnapshot): Promise<void> {
    const { error } = await this.supabase.from("calls").insert(callRow(snapshot));
    if (error) throw error;
  }

  async updateCall(snapshot: CallSnapshot): Promise<void> {
    const { error } = await this.supabase
      .from("calls")
      .update(callRow(snapshot))
      .eq("id", snapshot.id);
    if (error) throw error;
  }

  async appendCallEvent(input: {
    callId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.supabase.from("call_events").insert({
      call_id: input.callId,
      event_type: input.eventType,
      payload: input.payload
    });
    if (error) throw error;
  }

  async recordCallAudio(input: CallAudioFileInput): Promise<void> {
    const { error } = await this.supabase.from("call_audio_files").insert({
      call_id: input.callId,
      kind: input.kind,
      storage_path: input.storagePath,
      mime_type: input.mimeType,
      byte_size: input.byteSize
    });
    if (error) throw error;
  }

  async recordShowing(input: {
    callId: string;
    propertyId: string;
    calendarEventId: string;
    slot: ShowingSlot;
    status: "booked" | "requested" | "failed";
  }): Promise<void> {
    const { error } = await this.supabase.from("showings").insert({
      call_id: input.callId,
      property_id: input.propertyId,
      calendar_event_id: input.calendarEventId,
      start_at: input.slot.start,
      end_at: input.slot.end,
      status: input.status
    });
    if (error) throw error;
  }

  async recordEmail(input: {
    callId: string;
    resendEmailId?: string;
    recipients: string[];
    subject: string;
    status: "sent" | "failed";
    errorMessage?: string;
  }): Promise<void> {
    const { error } = await this.supabase.from("emails").insert({
      call_id: input.callId,
      resend_email_id: input.resendEmailId,
      recipients: input.recipients,
      subject: input.subject,
      status: input.status,
      error_message: input.errorMessage
    });
    if (error) throw error;
  }

  async recordMiroExport(input: {
    callId: string;
    boardId: string;
    itemId?: string;
    status: "synced" | "failed";
    errorMessage?: string;
  }): Promise<void> {
    const { error } = await this.supabase.from("miro_exports").insert({
      call_id: input.callId,
      board_id: input.boardId,
      item_id: input.itemId,
      status: input.status,
      error_message: input.errorMessage
    });
    if (error) throw error;
  }

  private async countRows(
    table: string,
    filters: Record<string, unknown>,
    gteColumn?: string,
    gteValue?: string
  ): Promise<number> {
    let query = this.supabase.from(table).select("*", { count: "exact", head: true });
    for (const [column, value] of Object.entries(filters)) {
      query = query.eq(column, value);
    }
    if (gteColumn && gteValue) {
      query = query.gte(gteColumn, gteValue);
    }
    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  }

  private async listCalendarConnections(clientId: string): Promise<
    Array<{
      calendarId: string;
      googleAccountEmail: string;
      connectedAt: string;
    }>
  > {
    const { data, error } = await this.supabase
      .from("calendar_connections")
      .select("calendar_id, google_account_email, connected_at")
      .eq("client_id", clientId)
      .order("connected_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map((row) => ({
      calendarId: row.calendar_id,
      googleAccountEmail: row.google_account_email,
      connectedAt: row.connected_at
    }));
  }
}

function mapClient(row: Record<string, any>): ClientProfile {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    timezone: row.timezone,
    managerEmails: row.manager_emails ?? [],
    ownerNotificationEmails: row.owner_notification_emails ?? [],
    transferPhoneNumber: row.transfer_phone_number,
    defaultShowingDurationMinutes: row.default_showing_duration_minutes,
    defaultShowingBufferMinutes: row.default_showing_buffer_minutes,
    applicationUrl: row.application_url,
    accessInformationPolicy: row.access_information_policy
  };
}

function mapProperty(row: Record<string, any>): PropertyRecord {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    streetNumber: row.street_number,
    streetName: row.street_name,
    city: row.city,
    state: row.state,
    beds: row.beds,
    baths: row.baths,
    monthlyRentCents: row.monthly_rent_cents,
    petPolicy: row.pet_policy,
    stories: row.stories,
    availableDate: row.available_date,
    applicationUrl: row.application_url,
    calendarId: row.calendar_id,
    showingInstructions: row.showing_instructions,
    accessInformationAllowed: row.access_information_allowed,
    active: row.active
  };
}

function callRow(snapshot: CallSnapshot): Record<string, unknown> {
  return {
    id: snapshot.id,
    client_id: snapshot.clientId,
    twilio_call_sid: snapshot.twilioCallSid,
    started_at: snapshot.startedAt,
    ended_at: snapshot.endedAt,
    status: snapshot.status,
    property_id: snapshot.propertyId,
    lead: snapshot.lead,
    qualification: snapshot.qualification,
    compliance_events: snapshot.complianceEvents,
    transcript: snapshot.transcript,
    outcome: snapshot.outcome,
    updated_at: new Date().toISOString()
  };
}

function mapDashboardCall(row: Record<string, any>): DashboardRecentCall {
  const lead = row.lead ?? {};
  return {
    id: row.id,
    startedAt: row.started_at,
    status: row.status,
    outcome: row.outcome ?? undefined,
    callerName: lead.callerName ?? undefined,
    callerPhone: lead.callerPhone ?? undefined,
    propertyAddress: lead.propertyAddress ?? lead.propertyNameRaw ?? undefined,
    qualificationStatus: row.qualification?.qualifiedToApply ?? undefined,
    showingRequested: lead.showingRequested === true,
    callbackRequested: lead.callbackRequested === true,
    complianceEventCount: complianceEventCount(row.compliance_events)
  };
}

function complianceEventCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function startOfTodayInTimezone(timezone: string): Date {
  const now = new Date();
  const parts = getZonedParts(now, timezone);
  const utcMidnight = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0));
  return new Date(utcMidnight.getTime() - getTimezoneOffsetMs(utcMidnight, timezone));
}

function getTimezoneOffsetMs(date: Date, timezone: string): number {
  const parts = getZonedParts(date, timezone);
  const zonedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return zonedAsUtc - date.getTime();
}

function getZonedParts(
  date: Date,
  timezone: string
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour ?? 0),
    minute: Number(parts.minute ?? 0),
    second: Number(parts.second ?? 0)
  };
}
