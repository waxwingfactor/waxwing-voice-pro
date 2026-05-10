import {
  Bell,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Download,
  FileAudio,
  Filter,
  Home,
  Mail,
  MapPinned,
  MessageSquareText,
  PhoneCall,
  PlayCircle,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert
} from "lucide-react";

export const dynamic = "force-dynamic";

interface DashboardData {
  client: {
    name: string;
    timezone: string;
    managerEmails?: string[];
  };
  counts: {
    activeProperties: number;
    calendarConnections: number;
  };
  recentCalls: Array<{
    id: string;
    startedAt: string;
    status: string;
    outcome?: string;
    callerName?: string;
    callerPhone?: string;
    callerEmail?: string;
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
  generatedAt: string;
}

export default async function CallsPage() {
  const result = await getDashboard();
  const data = result.ok ? result.data : fallbackDashboard();

  return (
    <main className="shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="brand">
          <span className="brandMark">WV</span>
          <span>Waxwing Voice</span>
        </div>
        <p className="navSection">Workspace</p>
        <nav>
          <a href="/">
            <Home size={18} aria-hidden /> Dashboard
          </a>
          <a className="active" href="/calls">
            <FileAudio size={18} aria-hidden /> Calls
          </a>
          <a href="/settings">
            <SlidersHorizontal size={18} aria-hidden /> Settings
          </a>
        </nav>
        <p className="navSection">Configure</p>
        <nav>
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
        <div className="agentCard">
          <span className="listenOrb" />
          <strong>Voice agent</strong>
          <small>Listening for calls</small>
          <span>{data.recentCalls.length} today · v2.4</span>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>Calls</h1>
            <p className="subtle">
              {data.recentCalls.length} total · {qualifiedCount(data)} qualified ·{" "}
              {showingsBookedCount(data)} showings booked
            </p>
          </div>
          <div className="topActions">
            <span className="listeningBadge">
              <span className="listenOrb" /> Agent is listening
            </span>
            <button className="iconButton" aria-label="Notifications">
              <Bell size={20} aria-hidden />
            </button>
            <a className="iconButton" href={`mailto:${firstManagerEmail(data)}`} aria-label="Email manager">
              <Mail size={20} aria-hidden />
            </a>
            <span className="avatar">WV</span>
          </div>
        </header>

        {!result.ok ? (
          <section className="notice" role="status">
            <TriangleAlert size={20} aria-hidden />
            <span>{result.error}</span>
          </section>
        ) : null}

        <section className="callsToolbar">
          <label className="searchBox">
            <Search size={22} aria-hidden />
            <input placeholder="Search caller, phone, property" aria-label="Search calls" />
          </label>
          <button type="button">
            <Filter size={20} aria-hidden /> Filters
          </button>
          <button type="button">
            <Download size={20} aria-hidden /> Export
          </button>
        </section>

        <section className="tabBar" aria-label="Call filters">
          <span className="active">All <b>{data.recentCalls.length}</b></span>
          <span>Qualified <b>{qualifiedCount(data)}</b></span>
          <span>Pending <b>{pendingCount(data)}</b></span>
          <span>Not qualified <b>{notQualifiedCount(data)}</b></span>
          <span>Showings booked <b>{showingsBookedCount(data)}</b></span>
        </section>

        <section className="band callsListCard" id="calls">
          <div className="callsHeaderRow">
            <span>Caller</span>
            <span>Property</span>
            <span>Move-in</span>
            <span>Status</span>
            <span>Score</span>
          </div>

          <div className="callStack" aria-label="Call details">
            {data.recentCalls.length > 0 ? (
              data.recentCalls.map((call, index) => (
                <details className="callRecord" key={call.id} open={index === 0}>
                  <summary>
                    <span className="summaryIcon phoneIcon">
                      <FileAudio size={18} aria-hidden />
                    </span>
                    <span className="miniAvatar">{initials(call.callerName)}</span>
                    <span>
                      <strong>{call.callerName ?? "Unknown caller"}</strong>
                      <small>{call.callerPhone ?? "No phone captured"}</small>
                    </span>
                    <span>{call.propertyAddress ?? "Property not captured"}</span>
                    <span>{stringValue(call.lead?.desiredMoveInDate)}</span>
                    <StatusPill value={call.qualificationStatus ?? call.status} />
                    <span className="scoreCell">
                      <i aria-hidden />
                      {leadScore(call)}
                    </span>
                  </summary>

                  <div className="callDetailGrid">
                    <a className="miniPageLink" href={`/calls/${call.id}`}>
                      Open call mini-page
                    </a>
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
            ) : (
              <div className="emptyRow">No calls have been logged yet today.</div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function RecordingPlayers({ call }: { call: DashboardData["recentCalls"][number] }) {
  const playableFiles = call.audioFiles.filter(
    (file) => file.signedUrl && file.mimeType.startsWith("audio/") && file.kind.endsWith("_wav")
  );
  const primaryFile =
    playableFiles.find((file) => file.kind === "mixed_wav") ?? playableFiles[0];
  const secondaryFiles = call.audioFiles.filter(
    (file) => file.signedUrl && file.storagePath !== primaryFile?.storagePath
  );

  if (!primaryFile && secondaryFiles.length === 0) {
    return (
      <p className="emptyState">
        No conversation recording is available yet. New calls will include one playable
        conversation track.
      </p>
    );
  }

  return (
    <div className="audioList">
      {primaryFile ? (
        <div className="audioTrack primaryAudioTrack">
          <div>
            <strong>{audioLabel(primaryFile.kind)}</strong>
            <span>{formatBytes(primaryFile.byteSize)}</span>
          </div>
          <audio controls preload="none" src={primaryFile.signedUrl} />
        </div>
      ) : (
        <p className="emptyState">
          This older call only has archived raw files. New calls will show one playable
          conversation track here.
        </p>
      )}
      {secondaryFiles.length > 0 ? (
        <details className="archiveDetails">
          <summary>More audio files</summary>
          <div className="archiveLinks">
            {secondaryFiles.map((file) => (
              <a href={file.signedUrl} key={file.storagePath}>
                <Download size={15} aria-hidden />
                {audioLabel(file.kind)}
              </a>
            ))}
          </div>
        </details>
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
    counts: { activeProperties: 0, calendarConnections: 0 },
    recentCalls: [],
    generatedAt: new Date().toISOString()
  };
}

function capturedRows(call: DashboardData["recentCalls"][number]) {
  const lead = call.lead ?? {};
  const rows = [
    { label: "Caller name", value: stringValue(call.callerName ?? lead.callerName) },
    { label: "Phone", value: stringValue(call.callerPhone ?? lead.callerPhone) },
    { label: "Email", value: stringValue(call.callerEmail ?? lead.callerEmail) },
    { label: "Property", value: stringValue(call.propertyAddress ?? lead.propertyAddress ?? lead.propertyNameRaw) },
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

function showingLabel(call: DashboardData["recentCalls"][number]): string {
  if (call.outcome === "showing_booked") return "Booked";
  if (call.showingRequested) return "Requested";
  return "None";
}

function speakerLabel(speaker: "caller" | "agent" | "system"): string {
  if (speaker === "caller") return "Caller";
  if (speaker === "agent") return "Agent";
  return "System";
}

function StatusPill({ value }: { value: string }) {
  const isBad = value.toLowerCase().includes("no") || value.toLowerCase().includes("failed");
  return <span className={isBad ? "statusPill bad" : "statusPill"}>{value}</span>;
}

function initials(name?: string): string {
  if (!name) return "??";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "??";
}

function leadScore(call: DashboardData["recentCalls"][number]): number {
  if (call.qualification?.qualifiedToApply === "yes") return 92;
  if (call.qualification?.qualifiedToApply === "debatable") return 63;
  if (call.qualification?.qualifiedToApply === "no") return 28;
  return call.showingRequested ? 78 : 50;
}

function qualifiedCount(data: DashboardData): number {
  return data.recentCalls.filter((call) => call.qualificationStatus === "yes").length;
}

function pendingCount(data: DashboardData): number {
  return data.recentCalls.filter((call) => !call.qualificationStatus).length;
}

function notQualifiedCount(data: DashboardData): number {
  return data.recentCalls.filter((call) => call.qualificationStatus === "no").length;
}

function showingsBookedCount(data: DashboardData): number {
  return data.recentCalls.filter((call) => call.outcome === "showing_booked").length;
}

function audioLabel(kind: string): string {
  const labels: Record<string, string> = {
    mixed_wav: "Conversation recording",
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
