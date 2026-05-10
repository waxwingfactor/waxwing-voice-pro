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

export interface AppRepository {
  getClientBySlug(slug: string): Promise<ClientProfile | null>;
  listActiveProperties(clientId: string): Promise<PropertyRecord[]>;
  getProperty(propertyId: string): Promise<PropertyRecord | null>;
  getCalendarConnection(
    clientId: string,
    calendarId: string
  ): Promise<CalendarConnection | null>;
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
