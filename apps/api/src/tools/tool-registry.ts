import {
  CallState,
  calculateIncomeThresholdCents,
  formatMoney,
  fullAddress,
  matchProperty,
  qualifyCaller,
  type ClientProfile,
  type CallOutcome,
  type PropertyRecord,
  type ShowingSlot,
  type TransferReason
} from "@waxwing/core";
import type { AppRepository } from "@waxwing/db";
import type { GoogleCalendarProvider } from "../providers/google-calendar.js";
import type { TwilioCallProvider } from "../providers/twilio-call.js";
import type { TokenVault } from "../security/token-vault.js";

export class ToolRegistry {
  constructor(
    private readonly deps: {
      repository: AppRepository;
      calendar: GoogleCalendarProvider;
      twilio: TwilioCallProvider;
      tokenVault: TokenVault;
      state: CallState;
      client: ClientProfile;
      twilioCallSid?: string;
    }
  ) {}

  async execute(call: {
    id?: string;
    name: string;
    args: Record<string, unknown>;
  }): Promise<Record<string, unknown>> {
    switch (call.name) {
      case "search_properties":
        return this.searchProperties(String(call.args.query ?? ""));
      case "get_property_details":
        return this.getPropertyDetails(String(call.args.property_id ?? ""));
      case "calculate_qualification":
        return this.calculateQualification(call.args);
      case "find_showing_slots":
        return this.findShowingSlots(call.args);
      case "book_showing":
        return this.bookShowing(call.args);
      case "transfer_call":
        return this.transferCall(String(call.args.reason ?? "unsafe_or_out_of_scope"));
      case "end_call":
        return this.endCall(String(call.args.outcome ?? "ended_without_lead"));
      case "log_call_event":
        return this.logCallEvent(call.args);
      default:
        return { ok: false, error: `Unknown tool: ${call.name}` };
    }
  }

  private async searchProperties(query: string): Promise<Record<string, unknown>> {
    const properties = await this.deps.repository.listActiveProperties(this.deps.client.id);
    const result = matchProperty(query, properties);
    if (result.property) {
      this.deps.state.setProperty(result.property.id);
      this.deps.state.mergeLead({
        propertyAddress: fullAddress(result.property),
        monthlyRentCents: result.property.monthlyRentCents
      });
    }
    return {
      status: result.status,
      property: result.property ? publicProperty(result.property) : undefined,
      candidates: result.candidates.map(publicProperty),
      next_best_question: result.nextBestQuestion
    };
  }

  private async getPropertyDetails(propertyId: string): Promise<Record<string, unknown>> {
    const property = await this.deps.repository.getProperty(propertyId);
    if (!property) return { ok: false, error: "Property not found." };
    this.deps.state.setProperty(property.id);
    this.deps.state.mergeLead({
      propertyAddress: fullAddress(property),
      monthlyRentCents: property.monthlyRentCents
    });
    return { ok: true, property: publicProperty(property) };
  }

  private async calculateQualification(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const property = await this.deps.repository.getProperty(String(args.property_id ?? ""));
    if (!property) return { ok: false, error: "Property not found." };

    const result = qualifyCaller({
      monthlyRentCents: property.monthlyRentCents,
      adultCount: Number(args.adult_count ?? 1),
      allCreditOver600:
        typeof args.all_credit_over_600 === "boolean"
          ? args.all_credit_over_600
          : undefined,
      creditScores: Array.isArray(args.credit_scores)
        ? args.credit_scores.map(Number)
        : undefined,
      incomeMeets3xRent: Boolean(args.income_meets_3x_rent),
      wantsCosigner: Boolean(args.wants_cosigner),
      wantsIncreasedDeposit: Boolean(args.wants_increased_deposit)
    });

    this.deps.state.setQualification(result);
    this.deps.state.mergeLead({
      isLead: true,
      adultCount: Number(args.adult_count ?? 1)
    });

    return {
      ok: true,
      qualification: {
        ...result,
        income_threshold: formatMoney(result.incomeThresholdCents)
      }
    };
  }

  private async findShowingSlots(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const propertyId = String(args.property_id ?? "");
    const property = await this.deps.repository.getProperty(propertyId);
    if (!property) return { ok: false, error: "Property not found." };

    if (property.availableDate && !isAvailableForDirectShowing(property.availableDate)) {
      return {
        ok: false,
        code: "property_not_available_for_direct_showing",
        property: publicProperty(property),
        message:
          "This property is not available for direct showing yet. Collect the caller's preferred showing time and tell them the office will coordinate after confirming access."
      };
    }

    const connection = property.calendarId
      ? await this.deps.repository.getCalendarConnection(this.deps.client.id, property.calendarId)
      : await this.deps.repository.getDefaultCalendarConnection(this.deps.client.id);
    if (!connection) {
      return {
        ok: false,
        code: "calendar_not_connected",
        property: publicProperty(property),
        error:
          "Google Calendar is not connected for this property. Collect the caller's preferred showing date or time and say the office will follow up to coordinate it."
      };
    }
    const calendarId = property.calendarId ?? connection.calendarId;

    const refreshToken = this.deps.tokenVault.decrypt(connection.encryptedRefreshToken);
    const defaultTimeMin = new Date(Date.now() + 5 * 60 * 60 * 1000);
    const preferredStart = parseOptionalDate(args.preferred_start);
    const preferredEnd = parseOptionalDate(args.preferred_end);
    const timeMin =
      preferredStart && preferredStart > defaultTimeMin ? preferredStart : defaultTimeMin;
    const timeMax =
      preferredEnd && preferredEnd > timeMin
        ? preferredEnd
        : new Date(timeMin.getTime() + 14 * 24 * 60 * 60 * 1000);
    const slots = await this.deps.calendar.findAvailableSlots({
      calendarId,
      refreshToken,
      timeMin,
      timeMax,
      durationMinutes: this.deps.client.defaultShowingDurationMinutes,
      timezone: this.deps.client.timezone,
      maxSlots: 10
    });
    const spokenOptions = slots.map((slot) => formatSlotForSpeech(slot, this.deps.client.timezone));
    const earliestSlot = slots[0];
    const latestSlot = slots.at(-1);

    return {
      ok: true,
      property: publicProperty(property),
      calendar_id: calendarId,
      timezone: this.deps.client.timezone,
      slots,
      spoken_options: spokenOptions,
      earliest_slot: earliestSlot,
      earliest_option: earliestSlot
        ? formatSlotForSpeech(earliestSlot, this.deps.client.timezone)
        : undefined,
      latest_slot: latestSlot,
      latest_option: latestSlot
        ? formatSlotForSpeech(latestSlot, this.deps.client.timezone)
        : undefined,
      message:
        slots.length > 0
          ? "Offer two or three of these options and ask which works best. If the caller asked for the earliest or latest time, answer using earliest_option or latest_option."
          : "No open showing slots were found in the requested window. Collect a preferred time and say the office will follow up."
    };
  }

  private async bookShowing(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const property = await this.deps.repository.getProperty(String(args.property_id ?? ""));
    if (!property) return { ok: false, error: "Property not found." };

    const start = new Date(String(args.start));
    const end = new Date(String(args.end));
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      return { ok: false, error: "Invalid showing time." };
    }

    if (isSameDay(start, new Date()) && start.getTime() - Date.now() < 5 * 60 * 60 * 1000) {
      return {
        ok: false,
        error: "Same-day showings must be at least five hours from now."
      };
    }

    const connection = property.calendarId
      ? await this.deps.repository.getCalendarConnection(this.deps.client.id, property.calendarId)
      : await this.deps.repository.getDefaultCalendarConnection(this.deps.client.id);
    if (!connection) {
      return { ok: false, error: "Google Calendar is not connected for this property." };
    }
    const calendarId = property.calendarId ?? connection.calendarId;

    const slot: ShowingSlot = {
      calendarId,
      start: start.toISOString(),
      end: end.toISOString()
    };
    const refreshToken = this.deps.tokenVault.decrypt(connection.encryptedRefreshToken);
    const event = await this.deps.calendar.bookShowing({
      calendarId,
      refreshToken,
      slot,
      summary: `Showing: ${fullAddress(property)}`,
      description: [
        `Caller: ${String(args.caller_name ?? "Unknown")}`,
        `Phone: ${String(args.caller_phone ?? "Unknown")}`,
        `Email: ${String(args.caller_email ?? "Unknown")}`,
        `Call ID: ${this.deps.state.value.id}`
      ].join("\n")
    });

    await this.deps.repository.recordShowing({
      callId: this.deps.state.value.id,
      propertyId: property.id,
      calendarEventId: event.eventId,
      slot,
      status: "booked"
    });
    this.deps.state.mergeLead(compactLeadUpdate({
      showingRequested: true,
      requestedShowingTime: slot.start,
      callerName: stringArg(args.caller_name) ?? stringArg(args.callerName),
      callerPhone: stringArg(args.caller_phone) ?? stringArg(args.callerPhone),
      callerEmail: stringArg(args.caller_email) ?? stringArg(args.callerEmail)
    }));

    return { ok: true, event_id: event.eventId, html_link: event.htmlLink };
  }

  private async transferCall(reasonRaw: string): Promise<Record<string, unknown>> {
    const reason = normalizeTransferReason(reasonRaw);
    this.deps.state.markTransferring(reason);
    if (this.deps.twilioCallSid) {
      await this.deps.twilio.transfer({
        callSid: this.deps.twilioCallSid,
        to: this.deps.client.transferPhoneNumber,
        reason
      });
    }
    return { ok: true, transferred: true, reason };
  }

  private async endCall(outcomeRaw: string): Promise<Record<string, unknown>> {
    const outcome = normalizeOutcome(outcomeRaw);
    this.deps.state.end(outcome);
    if (this.deps.twilioCallSid) {
      await this.deps.twilio.endCall(this.deps.twilioCallSid);
    }
    return { ok: true, ended: true, outcome };
  }

  private async logCallEvent(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const payload = (args.payload ?? {}) as Record<string, unknown>;
    this.deps.state.mergeLead(extractLeadUpdate(payload));
    await this.deps.repository.appendCallEvent({
      callId: this.deps.state.value.id,
      eventType: String(args.event_type ?? "agent_event"),
      payload
    });
    return { ok: true };
  }
}

function publicProperty(property: PropertyRecord): Record<string, unknown> {
  return {
    id: property.id,
    address: fullAddress(property),
    beds: property.beds,
    baths: property.baths,
    rent: formatMoney(property.monthlyRentCents),
    rent_cents: property.monthlyRentCents,
    income_threshold: formatMoney(calculateIncomeThresholdCents(property.monthlyRentCents)),
    pet_policy: property.petPolicy,
    stories: property.stories,
    available_date: property.availableDate,
    application_url: property.applicationUrl
  };
}

function extractLeadUpdate(payload: Record<string, unknown>): Record<string, unknown> {
  const update: Record<string, unknown> = {};
  copyString(payload, update, "callerName", ["callerName", "caller_name", "name"]);
  copyString(payload, update, "callerPhone", ["callerPhone", "caller_phone", "phone", "phone_number"]);
  copyString(payload, update, "callerEmail", ["callerEmail", "caller_email", "email"]);
  copyString(payload, update, "propertyNameRaw", [
    "propertyNameRaw",
    "property_name_raw",
    "propertyName",
    "property_name"
  ]);
  copyString(payload, update, "propertyAddress", [
    "propertyAddress",
    "property_address",
    "address"
  ]);
  copyString(payload, update, "desiredMoveInDate", [
    "desiredMoveInDate",
    "desired_move_in_date",
    "move_in_date"
  ]);
  copyString(payload, update, "desiredLengthOfStay", [
    "desiredLengthOfStay",
    "desired_length_of_stay",
    "length_of_stay"
  ]);
  copyString(payload, update, "requestedShowingTime", [
    "requestedShowingTime",
    "requested_showing_time",
    "showing_time"
  ]);
  copyNumber(payload, update, "adultCount", ["adultCount", "adult_count", "people_count"]);
  copyNumber(payload, update, "monthlyRentCents", ["monthlyRentCents", "monthly_rent_cents"]);
  copyMoney(payload, update, "monthlyRentCents", ["monthlyRent", "monthly_rent", "rent"]);
  copyBoolean(payload, update, "callbackRequested", ["callbackRequested", "callback_requested"]);
  copyBoolean(payload, update, "okWithPropertyStats", [
    "okWithPropertyStats",
    "ok_with_property_stats"
  ]);
  copyBoolean(payload, update, "applicationEncouraged", [
    "applicationEncouraged",
    "application_encouraged"
  ]);
  copyBoolean(payload, update, "showingRequested", ["showingRequested", "showing_requested"]);
  copyBoolean(payload, update, "isLead", ["isLead", "is_lead"]);
  return update;
}

function copyString(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  key: string,
  aliases: string[]
): void {
  const value = firstValue(source, aliases);
  if (typeof value === "string" && value.trim()) target[key] = value.trim();
}

function copyNumber(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  key: string,
  aliases: string[]
): void {
  const value = firstValue(source, aliases);
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(numeric)) target[key] = numeric;
}

function copyMoney(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  key: string,
  aliases: string[]
): void {
  const value = firstValue(source, aliases);
  if (typeof value !== "number" && typeof value !== "string") return;
  const normalized = Number(String(value).replace(/[$,\s]/g, ""));
  if (Number.isFinite(normalized)) target[key] = Math.round(normalized * 100);
}

function copyBoolean(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  key: string,
  aliases: string[]
): void {
  const value = firstValue(source, aliases);
  const parsed = parseBoolean(value);
  if (typeof parsed === "boolean") target[key] = parsed;
}

function firstValue(source: Record<string, unknown>, aliases: string[]): unknown {
  for (const alias of aliases) {
    if (source[alias] !== undefined && source[alias] !== null && source[alias] !== "") {
      return source[alias];
    }
  }
  return undefined;
}

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["true", "yes", "y"].includes(normalized)) return true;
  if (["false", "no", "n"].includes(normalized)) return false;
  return undefined;
}

function stringArg(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function compactLeadUpdate<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as T;
}

function normalizeTransferReason(reason: string): TransferReason {
  const allowed: TransferReason[] = [
    "maintenance",
    "general_office",
    "human_requested",
    "property_unclear",
    "immediate_access",
    "unsafe_or_out_of_scope"
  ];
  return allowed.includes(reason as TransferReason)
    ? (reason as TransferReason)
    : "unsafe_or_out_of_scope";
}

function normalizeOutcome(outcome: string): CallOutcome {
  const allowed: CallOutcome[] = [
    "lead_created",
    "showing_booked",
    "transferred",
    "not_a_leasing_call",
    "ended_without_lead",
    "failed"
  ];
  return allowed.includes(outcome as CallOutcome)
    ? (outcome as CallOutcome)
    : "ended_without_lead";
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function parseOptionalDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

function isAvailableForDirectShowing(availableDate: string): boolean {
  const normalized = availableDate.trim().toLowerCase();
  if (!normalized || normalized === "now" || normalized === "available now") return true;
  const date = new Date(availableDate);
  if (!Number.isFinite(date.getTime())) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date <= today;
}

function formatSlotForSpeech(slot: ShowingSlot, timezone: string): string {
  const start = new Date(slot.start);
  const end = new Date(slot.end);
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(start);
  const startTime = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit"
  }).format(start);
  const endTime = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit"
  }).format(end);
  return `${date} from ${startTime} to ${endTime}`;
}
