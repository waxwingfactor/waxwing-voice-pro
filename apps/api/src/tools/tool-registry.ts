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
        return this.findShowingSlots(String(call.args.property_id ?? ""));
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

  private async findShowingSlots(propertyId: string): Promise<Record<string, unknown>> {
    const property = await this.deps.repository.getProperty(propertyId);
    if (!property) return { ok: false, error: "Property not found." };
    if (!property.calendarId) {
      return { ok: false, error: "No calendar is configured for this property." };
    }

    const connection = await this.deps.repository.getCalendarConnection(
      this.deps.client.id,
      property.calendarId
    );
    if (!connection) {
      return { ok: false, error: "Google Calendar is not connected for this property." };
    }

    const refreshToken = this.deps.tokenVault.decrypt(connection.encryptedRefreshToken);
    const timeMin = new Date(Date.now() + 5 * 60 * 60 * 1000);
    const timeMax = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const slots = await this.deps.calendar.findAvailableSlots({
      calendarId: property.calendarId,
      refreshToken,
      timeMin,
      timeMax,
      durationMinutes: this.deps.client.defaultShowingDurationMinutes,
      timezone: this.deps.client.timezone
    });

    return { ok: true, slots };
  }

  private async bookShowing(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const property = await this.deps.repository.getProperty(String(args.property_id ?? ""));
    if (!property) return { ok: false, error: "Property not found." };
    if (!property.calendarId) return { ok: false, error: "Property has no calendar." };

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

    const connection = await this.deps.repository.getCalendarConnection(
      this.deps.client.id,
      property.calendarId
    );
    if (!connection) {
      return { ok: false, error: "Google Calendar is not connected for this property." };
    }

    const slot: ShowingSlot = {
      calendarId: property.calendarId,
      start: start.toISOString(),
      end: end.toISOString()
    };
    const refreshToken = this.deps.tokenVault.decrypt(connection.encryptedRefreshToken);
    const event = await this.deps.calendar.bookShowing({
      calendarId: property.calendarId,
      refreshToken,
      slot,
      summary: `Showing: ${fullAddress(property)}`,
      description: [
        `Caller: ${String(args.caller_name ?? "Unknown")}`,
        `Phone: ${String(args.caller_phone ?? "Unknown")}`,
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
    this.deps.state.mergeLead({
      showingRequested: true,
      requestedShowingTime: slot.start
    });

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
  const allowed = [
    "callerName",
    "callerPhone",
    "desiredMoveInDate",
    "desiredLengthOfStay",
    "callbackRequested",
    "okWithPropertyStats",
    "applicationEncouraged",
    "showingRequested"
  ];
  return Object.fromEntries(Object.entries(payload).filter(([key]) => allowed.includes(key)));
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
