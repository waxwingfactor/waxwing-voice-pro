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

  async listActiveProperties(clientId: string): Promise<PropertyRecord[]> {
    return properties.filter((property) => property.clientId === clientId && property.active);
  }

  async getProperty(propertyId: string): Promise<PropertyRecord | null> {
    return properties.find((property) => property.id === propertyId) ?? null;
  }

  async getCalendarConnection(): Promise<null> {
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
