import type {
  CallOutcome,
  CallSnapshot,
  ComplianceEvent,
  LeadCapture,
  QualificationResult,
  TransferReason
} from "./types.js";

export function createCallSnapshot(params: {
  id: string;
  clientId?: string;
  twilioCallSid?: string;
  startedAt?: Date;
}): CallSnapshot {
  return {
    id: params.id,
    clientId: params.clientId,
    twilioCallSid: params.twilioCallSid,
    startedAt: (params.startedAt ?? new Date()).toISOString(),
    status: "starting",
    lead: { isLead: false },
    transcript: [],
    complianceEvents: []
  };
}

export class CallState {
  private snapshot: CallSnapshot;

  constructor(snapshot: CallSnapshot) {
    this.snapshot = snapshot;
  }

  get value(): CallSnapshot {
    return structuredClone(this.snapshot);
  }

  activate(): void {
    this.snapshot.status = "active";
  }

  mergeLead(update: Partial<LeadCapture>): void {
    this.snapshot.lead = { ...this.snapshot.lead, ...update };
  }

  setProperty(propertyId: string): void {
    this.snapshot.propertyId = propertyId;
    this.mergeLead({ propertyId });
  }

  setQualification(qualification: QualificationResult): void {
    this.snapshot.qualification = qualification;
  }

  addTranscript(speaker: "caller" | "agent" | "system", text: string, at = new Date()): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    const last = this.snapshot.transcript.at(-1);
    if (last?.speaker === speaker && shouldMergeTranscriptTurn(last.at, at)) {
      last.text = mergeTranscriptText(last.text, trimmed);
      last.at = at.toISOString();
      return;
    }
    this.snapshot.transcript.push({
      speaker,
      text: trimmed,
      at: at.toISOString()
    });
  }

  addComplianceEvent(event: ComplianceEvent): void {
    this.snapshot.complianceEvents.push(event);
  }

  markTransferring(reason: TransferReason): void {
    this.snapshot.status = "transferring";
    this.snapshot.outcome = "transferred";
    this.addTranscript("system", `Transfer requested: ${reason}`);
  }

  end(outcome: CallOutcome, endedAt = new Date()): void {
    this.snapshot.status = "ended";
    this.snapshot.outcome = outcome;
    this.snapshot.endedAt = endedAt.toISOString();
  }

  fail(reason: string, endedAt = new Date()): void {
    this.snapshot.status = "failed";
    this.snapshot.outcome = "failed";
    this.snapshot.endedAt = endedAt.toISOString();
    this.addTranscript("system", `Failure: ${reason}`, endedAt);
  }
}

function shouldMergeTranscriptTurn(previousAt: string, nextAt: Date): boolean {
  const previousTime = new Date(previousAt).getTime();
  if (!Number.isFinite(previousTime)) return false;
  return nextAt.getTime() - previousTime < 12_000;
}

function mergeTranscriptText(previous: string, next: string): string {
  if (previous === next || previous.endsWith(next)) return previous;
  if (next.startsWith(previous)) return next;
  if (/^[,.;:!?]/.test(next)) return `${previous}${next}`;
  if (/[([{/"']$/.test(previous)) return `${previous}${next}`;
  return `${previous} ${next}`;
}
