import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Download,
  FileAudio,
  Mail,
  MapPinned,
  MessageSquareText,
  PhoneCall,
  PlayCircle,
  ShieldCheck,
  TriangleAlert
} from "lucide-react";

export const dynamic = "force-dynamic";

interface CallDetailData {
  client: {
    name: string;
    timezone: string;
    managerEmails?: string[];
  };
  call: DashboardCall;
  generatedAt: string;
}

interface DashboardCall {
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
  lead: Record<string, unknown>;
  qualification?: {
    incomeThresholdCents: number;
    creditAverage?: number;
    creditOver600: boolean;
    incomeMeets3xRent: boolean;
    qualifiedToApply: string;
    needsHumanFollowUp: boolean;
  };
  transcript: Array<{
    speaker: "caller" | "agent" | "system";
    text: string;
    at: string;
  }>;
  audioFiles: Array<{
    kind: string;
    storagePath: string;
    mimeType: string;
    byteSize: number;
    createdAt: string;
    signedUrl?: string;
  }>;
}

export default async function CallDetailPage({
  params
}: {
  params: Promise<{ callId: string }>;
}) {
  const { callId } = await params;
  const result = await getCallDetail(callId);
  const data = result.ok ? result.data : fallbackCallDetail(callId);
  const call = data.call;

  return (
    <main className="shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="brand">
          <PhoneCall size={24} aria-hidden />
          <span>Waxwing Voice Pro</span>
        </div>
        <nav>
          <a href="/">
            <CheckCircle2 size={18} aria-hidden /> Overview
          </a>
          <a className="active" href="/calls">
            <FileAudio size={18} aria-hidden /> Calls
          </a>
          <a href="/#calendar">
            <CalendarCheck size={18} aria-hidden /> Calendar
          </a>
          <a href="/#miro">
            <MapPinned size={18} aria-hidden /> Miro
          </a>
          <a href="/#compliance">
            <ShieldCheck size={18} aria-hidden /> Compliance
          </a>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <a className="backLink" href="/calls">
              <ArrowLeft size={16} aria-hidden />
              All calls
            </a>
            <p className="eyebrow">{data.client.name}</p>
            <h1>{call.callerName ?? "Unknown caller"}</h1>
            <p className="subtle">
              {formatDateTime(call.startedAt, data.client.timezone)} ·{" "}
              {call.propertyAddress ?? "Property not captured"}
            </p>
          </div>
          <a className="iconButton" href={`mailto:${firstManagerEmail(data)}`} aria-label="Email manager">
            <Mail size={20} aria-hidden />
          </a>
        </header>

        {!result.ok ? (
          <section className="notice" role="status">
            <TriangleAlert size={20} aria-hidden />
            <span>{result.error}</span>
          </section>
        ) : null}

        <section className="metrics" aria-label="Call status">
          <Metric label="Status" value={call.qualificationStatus ?? call.outcome ?? call.status} />
          <Metric label="Showing" value={showingLabel(call)} />
          <Metric label="Callback" value={call.callbackRequested ? "Requested" : "No"} />
          <Metric label="Compliance items" value={String(call.complianceEventCount)} />
        </section>

        <section className="band">
          <div className="sectionHeader">
            <div>
              <h2>Call Details</h2>
              <p>Recording, structured captured info, and transcript for this call.</p>
            </div>
            <span className="pill">{call.id}</span>
          </div>

          <div className="callDetailGrid singleCallDetail">
            <section className="detailBlock audioBlock" aria-label="Recording player">
              <div className="blockTitle">
                <PlayCircle size={18} aria-hidden />
                <h3>Recording</h3>
              </div>
              <RecordingPlayers call={call} />
            </section>

            <section className="detailBlock" aria-label="Captured call information">
              <div className="blockTitle">
                <ClipboardList size={18} aria-hidden />
                <h3>Captured Info</h3>
              </div>
              <CapturedInfo call={call} />
            </section>

            <section className="detailBlock transcriptBlock" aria-label="Structured transcript">
              <div className="blockTitle">
                <MessageSquareText size={18} aria-hidden />
                <h3>Transcript</h3>
              </div>
              <Transcript call={call} timezone={data.client.timezone} />
            </section>
          </div>
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric compactMetric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RecordingPlayers({ call }: { call: DashboardCall }) {
  const playableFiles = call.audioFiles.filter(
    (file) => file.signedUrl && file.mimeType.startsWith("audio/") && file.kind.endsWith("_wav")
  );
  const archivedFiles = call.audioFiles.filter((file) => file.signedUrl && !file.kind.endsWith("_wav"));

  if (playableFiles.length === 0 && archivedFiles.length === 0) {
    return <p className="emptyState">No recording is available yet.</p>;
  }

  return (
    <div className="audioList">
      {playableFiles.map((file) => (
        <div className="audioTrack" key={file.storagePath}>
          <div>
            <strong>{audioLabel(file.kind)}</strong>
            <span>{formatBytes(file.byteSize)}</span>
          </div>
          <audio controls preload="none" src={file.signedUrl} />
        </div>
      ))}
      {archivedFiles.length > 0 ? (
        <div className="archiveLinks">
          {archivedFiles.map((file) => (
            <a href={file.signedUrl} key={file.storagePath}>
              <Download size={15} aria-hidden />
              {audioLabel(file.kind)}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CapturedInfo({ call }: { call: DashboardCall }) {
  const rows = capturedRows(call);
  if (rows.length === 0) {
    return <p className="emptyState">No structured fields were captured on this call.</p>;
  }

  return (
    <dl className="infoGrid">
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Transcript({ call, timezone }: { call: DashboardCall; timezone: string }) {
  if (call.transcript.length === 0) {
    return <p className="emptyState">No transcript turns have been saved for this call yet.</p>;
  }

  return (
    <ol className="transcript">
      {call.transcript.map((turn, index) => (
        <li className={turn.speaker} key={`${turn.at}-${index}`}>
          <div>
            <strong>{speakerLabel(turn.speaker)}</strong>
            <time>{formatTime(turn.at, timezone)}</time>
          </div>
          <p>{turn.text}</p>
        </li>
      ))}
    </ol>
  );
}

async function getCallDetail(
  callId: string
): Promise<{ ok: true; data: CallDetailData } | { ok: false; error: string }> {
  const baseUrl = process.env.API_BASE_URL ?? "http://localhost:8787";
  const url = new URL(`/dashboard/calls/${encodeURIComponent(callId)}`, baseUrl);
  url.searchParams.set("client_slug", process.env.DASHBOARD_CLIENT_SLUG ?? "default");

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: process.env.DASHBOARD_API_KEY
        ? { Authorization: `Bearer ${process.env.DASHBOARD_API_KEY}` }
        : undefined
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Call API returned ${response.status}. Check API_BASE_URL and DASHBOARD_API_KEY.`
      };
    }

    return { ok: true, data: (await response.json()) as CallDetailData };
  } catch (error) {
    return {
      ok: false,
      error: `Call API is unavailable: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

function fallbackCallDetail(callId: string): CallDetailData {
  return {
    client: { name: "Waxwing Voice Pro", timezone: "America/Chicago" },
    call: {
      id: callId,
      startedAt: new Date().toISOString(),
      status: "unknown",
      showingRequested: false,
      callbackRequested: false,
      complianceEventCount: 0,
      lead: {},
      transcript: [],
      audioFiles: []
    },
    generatedAt: new Date().toISOString()
  };
}

function capturedRows(call: DashboardCall) {
  const lead = call.lead ?? {};
  const rows = [
    { label: "Caller name", value: stringValue(call.callerName ?? lead.callerName) },
    { label: "Phone", value: stringValue(call.callerPhone ?? lead.callerPhone) },
    {
      label: "Property",
      value: stringValue(call.propertyAddress ?? lead.propertyAddress ?? lead.propertyNameRaw)
    },
    { label: "Monthly rent", value: moneyValue(lead.monthlyRentCents) },
    { label: "Adults", value: stringValue(lead.adultCount) },
    { label: "Move-in date", value: stringValue(lead.desiredMoveInDate) },
    { label: "Length of stay", value: stringValue(lead.desiredLengthOfStay) },
    { label: "Showing", value: showingLabel(call) },
    { label: "Requested time", value: stringValue(lead.requestedShowingTime) },
    { label: "Callback requested", value: yesNoValue(lead.callbackRequested) },
    { label: "Application encouraged", value: yesNoValue(lead.applicationEncouraged) },
    { label: "Qualified", value: stringValue(call.qualification?.qualifiedToApply) },
    { label: "Credit over 600", value: yesNoValue(call.qualification?.creditOver600) },
    { label: "Income meets 3x rent", value: yesNoValue(call.qualification?.incomeMeets3xRent) },
    { label: "Income threshold", value: moneyValue(call.qualification?.incomeThresholdCents) }
  ];

  return rows.filter((row) => row.value !== "Not captured");
}

function formatDateTime(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatTime(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function showingLabel(call: DashboardCall): string {
  if (call.outcome === "showing_booked") return "Booked";
  if (call.showingRequested) return "Requested";
  return "None";
}

function speakerLabel(speaker: "caller" | "agent" | "system"): string {
  if (speaker === "caller") return "Caller";
  if (speaker === "agent") return "Morgan";
  return "System";
}

function audioLabel(kind: string): string {
  const labels: Record<string, string> = {
    inbound_wav: "Caller audio",
    outbound_wav: "Agent audio",
    inbound_raw_ulaw: "Caller raw archive",
    outbound_raw_ulaw: "Agent raw archive",
    metadata: "Audio metadata"
  };
  return labels[kind] ?? kind.replaceAll("_", " ");
}

function stringValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not captured";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function yesNoValue(value: unknown): string {
  if (typeof value !== "boolean") return "Not captured";
  return value ? "Yes" : "No";
}

function moneyValue(value: unknown): string {
  if (typeof value !== "number") return "Not captured";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value / 100);
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function firstManagerEmail(data: CallDetailData): string {
  return data.client.managerEmails?.[0] ?? "alex@waxwingfactory.com";
}
