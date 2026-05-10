import type {
  AppRepository,
  ArtifactStorage,
  CallAudioFileInput
} from "@waxwing/db";
import type {
  CallSnapshot,
  ClientProfile,
  PropertyRecord,
  ShowingSlot
} from "@waxwing/core";

const client: ClientProfile = {
  id: "00000000-0000-0000-0000-000000000001",
  slug: "default",
  name: "Hunter Property Management",
  timezone: "America/Chicago",
  managerEmails: ["manager@example.com"],
  ownerNotificationEmails: ["owner@example.com"],
  transferPhoneNumber: "+15555550100",
  defaultShowingDurationMinutes: 30,
  defaultShowingBufferMinutes: 15,
  applicationUrl: "https://hunterpm.com/availability",
  accessInformationPolicy: "transfer_only"
};

const properties: PropertyRecord[] = [
  {
    id: "10000000-0000-0000-0000-000000000001",
    clientId: client.id,
    streetNumber: "109",
    streetName: "Clear Water",
    city: "Boerne",
    state: "TX",
    beds: 4,
    baths: 2.5,
    monthlyRentCents: 279500,
    petPolicy: "dogs_only",
    stories: 2,
    availableDate: "2026-07-14",
    active: true,
    accessInformationAllowed: false
  },
  {
    id: "10000000-0000-0000-0000-000000000003",
    clientId: client.id,
    streetNumber: "152",
    streetName: "Navarro Crossing",
    city: "Seguin",
    state: "TX",
    beds: 3,
    baths: 2,
    monthlyRentCents: 149500,
    petPolicy: "cats_and_dogs",
    stories: 1,
    availableDate: "Now",
    active: true,
    accessInformationAllowed: false
  }
];

export class InMemoryRepository implements AppRepository {
  private readonly calls = new Map<string, CallSnapshot>();

  async getClientBySlug(slug: string): Promise<ClientProfile | null> {
    return slug === client.slug ? client : null;
  }

  async getDashboardSnapshot(clientSlug: string) {
    if (clientSlug !== client.slug) return null;
    const calls = [...this.calls.values()]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, 10);

    return {
      client,
      metrics: {
        callsToday: calls.length,
        qualifiedLeadsToday: calls.filter(
          (call) => call.qualification?.qualifiedToApply === "yes"
        ).length,
        showingsBookedToday: calls.filter((call) => call.outcome === "showing_booked").length,
        followUpsToday: calls.filter(
          (call) => call.lead.callbackRequested || call.status === "failed"
        ).length,
        complianceEventsToday: calls.reduce(
          (count, call) => count + call.complianceEvents.length,
          0
        )
      },
      recentCalls: calls.map((call) => ({
        id: call.id,
        startedAt: call.startedAt,
        status: call.status,
        outcome: call.outcome,
        callerName: call.lead.callerName,
        callerPhone: call.lead.callerPhone,
        propertyAddress: call.lead.propertyAddress,
        qualificationStatus: call.qualification?.qualifiedToApply,
        showingRequested: call.lead.showingRequested === true,
        callbackRequested: call.lead.callbackRequested === true,
        complianceEventCount: call.complianceEvents.length,
        lead: call.lead as unknown as Record<string, unknown>,
        qualification: call.qualification,
        transcript: call.transcript,
        audioFiles: []
      })),
      counts: {
        activeProperties: properties.length,
        calendarConnections: 0
      },
      calendarConnections: []
    };
  }

  async getDashboardCall(clientSlug: string, callId: string) {
    if (clientSlug !== client.slug) return null;
    const call = this.calls.get(callId);
    if (!call) return null;
    return {
      client,
      call: {
        id: call.id,
        startedAt: call.startedAt,
        status: call.status,
        outcome: call.outcome,
        callerName: call.lead.callerName,
        callerPhone: call.lead.callerPhone,
        propertyAddress: call.lead.propertyAddress,
        qualificationStatus: call.qualification?.qualifiedToApply,
        showingRequested: call.lead.showingRequested === true,
        callbackRequested: call.lead.callbackRequested === true,
        complianceEventCount: call.complianceEvents.length,
        lead: call.lead as unknown as Record<string, unknown>,
        qualification: call.qualification,
        transcript: call.transcript,
        audioFiles: []
      }
    };
  }

  async listActiveProperties(clientId: string): Promise<PropertyRecord[]> {
    return properties.filter((property) => property.clientId === clientId && property.active);
  }

  async getProperty(propertyId: string): Promise<PropertyRecord | null> {
    return properties.find((property) => property.id === propertyId) ?? null;
  }

  async getCallIdByTwilioSid(twilioCallSid: string): Promise<string | null> {
    return (
      [...this.calls.values()].find((call) => call.twilioCallSid === twilioCallSid)?.id ?? null
    );
  }

  async upsertCalendarConnection(): Promise<void> {}

  async getCalendarConnection(): Promise<null> {
    return null;
  }

  async getDefaultCalendarConnection(): Promise<null> {
    return null;
  }

  async createCall(snapshot: CallSnapshot): Promise<void> {
    this.calls.set(snapshot.id, snapshot);
  }

  async updateCall(snapshot: CallSnapshot): Promise<void> {
    this.calls.set(snapshot.id, snapshot);
  }

  async appendCallEvent(): Promise<void> {}
  async recordCallAudio(_input: CallAudioFileInput): Promise<void> {}
  async recordShowing(_input: {
    callId: string;
    propertyId: string;
    calendarEventId: string;
    slot: ShowingSlot;
    status: "booked" | "requested" | "failed";
  }): Promise<void> {}
  async recordEmail(): Promise<void> {}
  async recordMiroExport(): Promise<void> {}
}

export class InMemoryStorage implements ArtifactStorage {
  private readonly files = new Map<string, Buffer>();

  async upload(path: string, body: Buffer): Promise<void> {
    this.files.set(path, body);
  }

  async createSignedUrl(path: string): Promise<string> {
    return `memory://call-artifacts/${path}`;
  }
}
