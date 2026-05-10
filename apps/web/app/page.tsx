import {
  CalendarCheck,
  CheckCircle2,
  Clock3,
  ClipboardList,
  Download,
  FileAudio,
  Mail,
  MapPinned,
  MessageSquareText,
  PlayCircle,
  PhoneCall,
  ShieldCheck,
  TriangleAlert,
  UserRoundCheck
} from "lucide-react";

export const dynamic = "force-dynamic";

interface DashboardData {
  client: {
    name: string;
    timezone: string;
    managerEmails?: string[];
  };
  metrics: {
    callsToday: number;
    qualifiedLeadsToday: number;
    showingsBookedToday: number;
    followUpsToday: number;
    complianceEventsToday: number;
  };
  counts: {
    activeProperties: number;
    calendarConnections: number;
  };
  calendarConnections: Array<{
    calendarId: string;
    googleAccountEmail: string;
    connectedAt: string;
  }>;
  recentCalls: Array<{
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
  }>;
  integrations: {
    api: boolean;
    twilio: boolean;
    gemini: boolean;
    resend: boolean;
    googleCalendar: boolean;
    miro: boolean;
  };
  generatedAt: string;
}

export default async function DashboardPage() {
  const result = await getDashboard();
  const data = result.ok ? result.data : fallbackDashboard();

  return (
    <main className="shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="brand">
          <PhoneCall size={24} aria-hidden />
          <span>Waxwing Voice Pro</span>
        </div>
        <nav>
          <a className="active" href="#overview">
            <CheckCircle2 size={18} aria-hidden /> Overview
          </a>
          <a href="#calls">
            <FileAudio size={18} aria-hidden /> Calls
          </a>
          <a href="#calendar">
            <CalendarCheck size={18} aria-hidden /> Calendar
          </a>
          <a href="#miro">
            <MapPinned size={18} aria-hidden /> Miro
          </a>
          <a href="#compliance">
            <ShieldCheck size={18} aria-hidden /> Compliance
          </a>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{data.client.name}</p>
            <h1>Leasing Voice Operations</h1>
            <p className="subtle">
              Updated {formatDateTime(data.generatedAt, data.client.timezone)}
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

        <section className="metrics" id="overview" aria-label="Call metrics">
          <Metric
            icon={<PhoneCall size={20} />}
            label="Calls today"
            value={String(data.metrics.callsToday)}
          />
          <Metric
            icon={<UserRoundCheck size={20} />}
            label="Qualified leads"
            value={String(data.metrics.qualifiedLeadsToday)}
          />
          <Metric
            icon={<CalendarCheck size={20} />}
            label="Showings booked"
            value={String(data.metrics.showingsBookedToday)}
          />
          <Metric
            icon={<Clock3 size={20} />}
            label="Follow-ups"
            value={String(data.metrics.followUpsToday)}
          />
        </section>

        <section className="band" id="calls">
          <div className="sectionHeader">
            <div>
              <h2>Calls</h2>
              <p>Listen to recordings, review the transcript, and inspect captured lead fields.</p>
            </div>
            <span className="pill">{data.counts.activeProperties} active properties</span>
          </div>
          <div className="table compactTable" role="table" aria-label="Recent calls">
            <div className="row header" role="row">
              <span>Time</span>
              <span>Caller</span>
              <span>Property</span>
              <span>Status</span>
              <span>Showing</span>
            </div>
            {data.recentCalls.length > 0 ? (
              data.recentCalls.map((call) => (
                <div className="row" role="row" key={call.id}>
                  <span>{formatTime(call.startedAt, data.client.timezone)}</span>
                  <span title={call.callerPhone}>{call.callerName ?? "Unknown"}</span>
                  <span>{call.propertyAddress ?? "Not captured"}</span>
                  <span>{call.qualificationStatus ?? call.outcome ?? call.status}</span>
                  <span>{showingLabel(call)}</span>
                </div>
              ))
            ) : (
              <div className="emptyRow">No calls have been logged yet today.</div>
            )}
          </div>
          <div className="callStack" aria-label="Call details">
            {data.recentCalls.length > 0 ? (
              data.recentCalls.map((call, index) => (
                <details className="callRecord" key={call.id} open={index === 0}>
                  <summary>
                    <span className="summaryIcon">
                      <FileAudio size={18} aria-hidden />
                    </span>
                    <span>
                      <strong>{call.callerName ?? "Unknown caller"}</strong>
                      <small>
                        {formatDateTime(call.startedAt, data.client.timezone)} ·{" "}
                        {call.propertyAddress ?? "Property not captured"}
                      </small>
                    </span>
                    <span className="summaryStatus">{call.qualificationStatus ?? call.status}</span>
                  </summary>

                  <div className="callDetailGrid">
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
                </details>
              ))
            ) : null}
          </div>
        </section>

        <section className="split">
          <div className="panel" id="calendar">
            <h2>Connection Health</h2>
            <ul className="statusList">
              <StatusItem ok={data.integrations.twilio} label="Twilio voice credentials" />
              <StatusItem ok={data.integrations.gemini} label="Gemini Live configured" />
              <StatusItem ok={data.integrations.resend} label="Resend email configured" />
              <StatusItem
                ok={data.integrations.googleCalendar}
                label={`${data.counts.calendarConnections} Google Calendar connection${
                  data.counts.calendarConnections === 1 ? "" : "s"
                }`}
              />
              <StatusItem ok={data.integrations.miro} label="Miro sync optional" />
            </ul>
            {data.calendarConnections.length > 0 ? (
              <div className="connectionCard">
                <strong>{data.calendarConnections[0].googleAccountEmail}</strong>
                <span>{data.calendarConnections[0].calendarId}</span>
              </div>
            ) : null}
          </div>

          <div className="panel" id="compliance">
            <h2>Fair Housing Guardrails</h2>
            <p>
              Calls are tracked for protected-class-sensitive requests and other review events.
            </p>
            <div className="callout">
              <ShieldCheck size={22} aria-hidden />
              <span>
                {data.metrics.complianceEventsToday} compliance review item
                {data.metrics.complianceEventsToday === 1 ? "" : "s"} today
              </span>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function Metric({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="metric">
      <div className="metricIcon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusItem({ ok, label }: { ok: boolean; label: string }) {
  const Icon = ok ? CheckCircle2 : TriangleAlert;
  return (
    <li className={ok ? "ok" : "warn"}>
      <Icon size={18} aria-hidden />
      {label}
    </li>
  );
}

function capturedRows(call: DashboardData["recentCalls"][number]) {
  const lead = call.lead ?? {};
  const rows = [
    { label: "Caller name", value: stringValue(lead.callerName) },
    { label: "Phone", value: stringValue(lead.callerPhone) },
    { label: "Property", value: stringValue(lead.propertyAddress ?? lead.propertyNameRaw) },
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

function RecordingPlayers({ call }: { call: DashboardData["recentCalls"][number] }) {
  const playableFiles = call.audioFiles.filter(
    (file) => file.signedUrl && file.mimeType.startsWith("audio/") && file.kind.endsWith("_wav")
  );
  const archivedFiles = call.audioFiles.filter((file) => file.signedUrl && !file.kind.endsWith("_wav"));

  if (playableFiles.length === 0 && archivedFiles.length === 0) {
    return (
      <p className="emptyState">
        No recording is available yet. New calls will include browser-playable audio.
      </p>
    );
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

function CapturedInfo({ call }: { call: DashboardData["recentCalls"][number] }) {
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

function Transcript({
  call,
  timezone
}: {
  call: DashboardData["recentCalls"][number];
  timezone: string;
}) {
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

async function getDashboard(): Promise<
  | { ok: true; data: DashboardData }
  | { ok: false; error: string }
> {
  const baseUrl = process.env.API_BASE_URL ?? "http://localhost:8787";
  const url = new URL("/dashboard", baseUrl);
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
        error: `Dashboard API returned ${response.status}. Check API_BASE_URL and DASHBOARD_API_KEY.`
      };
    }

    return { ok: true, data: (await response.json()) as DashboardData };
  } catch (error) {
    return {
      ok: false,
      error: `Dashboard API is unavailable: ${
        error instanceof Error ? error.message : String(error)
      }`
    };
  }
}

function fallbackDashboard(): DashboardData {
  return {
    client: { name: "Waxwing Voice Pro", timezone: "America/Chicago" },
    metrics: {
      callsToday: 0,
      qualifiedLeadsToday: 0,
      showingsBookedToday: 0,
      followUpsToday: 0,
      complianceEventsToday: 0
    },
    counts: { activeProperties: 0, calendarConnections: 0 },
    calendarConnections: [],
    recentCalls: [],
    integrations: {
      api: false,
      twilio: false,
      gemini: false,
      resend: false,
      googleCalendar: false,
      miro: false
    },
    generatedAt: new Date().toISOString()
  };
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

function showingLabel(call: DashboardData["recentCalls"][number]): string {
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

function firstManagerEmail(data: DashboardData): string {
  return data.client.managerEmails?.[0] ?? "alex@waxwingfactory.com";
}
