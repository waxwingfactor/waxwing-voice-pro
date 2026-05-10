export type ISODateTime = string;

export type PetPolicy =
  | "not_allowed"
  | "cats_only"
  | "dogs_only"
  | "cats_and_dogs"
  | "caged_pets_only"
  | "unknown";

export type QualificationStatus = "yes" | "debatable" | "no";

export type CallOutcome =
  | "lead_created"
  | "showing_booked"
  | "transferred"
  | "not_a_leasing_call"
  | "ended_without_lead"
  | "failed";

export type TransferReason =
  | "maintenance"
  | "general_office"
  | "human_requested"
  | "property_unclear"
  | "immediate_access"
  | "unsafe_or_out_of_scope";

export type ProtectedClass =
  | "race"
  | "color"
  | "religion"
  | "sex"
  | "national_origin"
  | "familial_status"
  | "disability"
  | "other_local_protected_class";

export interface ClientProfile {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  managerEmails: string[];
  ownerNotificationEmails: string[];
  transferPhoneNumber: string;
  defaultShowingDurationMinutes: number;
  defaultShowingBufferMinutes: number;
  applicationUrl: string;
  accessInformationPolicy: "transfer_only" | "disabled";
}

export interface PropertyRecord {
  id: string;
  clientId: string;
  name?: string | null;
  streetNumber: string;
  streetName: string;
  city: string;
  state: string;
  beds?: number | null;
  baths?: number | null;
  monthlyRentCents: number;
  petPolicy: PetPolicy;
  stories?: number | null;
  availableDate?: string | null;
  applicationUrl?: string | null;
  calendarId?: string | null;
  showingInstructions?: string | null;
  accessInformationAllowed: boolean;
  active: boolean;
}

export interface PropertyMatch {
  status: "matched" | "ambiguous" | "not_found";
  property?: PropertyRecord;
  candidates: PropertyRecord[];
  nextBestQuestion?: "street_number" | "street_name" | "city" | "stories";
}

export interface QualificationInput {
  monthlyRentCents: number;
  adultCount: number;
  allCreditOver600?: boolean;
  creditScores?: number[];
  incomeMeets3xRent: boolean;
  wantsCosigner?: boolean;
  wantsIncreasedDeposit?: boolean;
}

export interface QualificationResult {
  incomeThresholdCents: number;
  creditAverage?: number;
  creditOver600: boolean;
  incomeMeets3xRent: boolean;
  qualifiedToApply: QualificationStatus;
  needsHumanFollowUp: boolean;
}

export interface LeadCapture {
  propertyId?: string;
  propertyNameRaw?: string;
  propertyAddress?: string;
  monthlyRentCents?: number;
  adultCount?: number;
  callerName?: string;
  callerPhone?: string;
  callerEmail?: string;
  desiredMoveInDate?: string;
  desiredLengthOfStay?: string;
  showingRequested?: boolean;
  requestedShowingTime?: string;
  callbackRequested?: boolean;
  okWithPropertyStats?: boolean;
  applicationEncouraged?: boolean;
  isLead: boolean;
}

export interface ComplianceEvent {
  kind:
    | "protected_class_detected"
    | "protected_class_question_refused"
    | "approval_promise_prevented"
    | "steering_prevented";
  protectedClasses: ProtectedClass[];
  safeSummary: string;
  createdAt: ISODateTime;
}

export interface CallSnapshot {
  id: string;
  clientId?: string;
  twilioCallSid?: string;
  startedAt: ISODateTime;
  endedAt?: ISODateTime;
  status: "starting" | "active" | "transferring" | "ending" | "ended" | "failed";
  propertyId?: string;
  lead: LeadCapture;
  qualification?: QualificationResult;
  complianceEvents: ComplianceEvent[];
  transcript: Array<{
    speaker: "caller" | "agent" | "system";
    text: string;
    at: ISODateTime;
  }>;
  outcome?: CallOutcome;
}

export interface ShowingSlot {
  start: ISODateTime;
  end: ISODateTime;
  calendarId: string;
}
