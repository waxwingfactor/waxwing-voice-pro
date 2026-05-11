import {
  Bell,
  CalendarCheck,
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
import { CallAudioPlayer } from "../components/call-audio-player";

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

type CallsFilter = "all" | "qualified" | "pending" | "not-qualified" | "showings";

export default async function CallsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const result = await getDashboard();
  const data = result.ok ? result.data : fallbackDashboard();
  const params = (await searchParams) ?? {};
  const filter = callsFilter(firstParam(params.filter));
  const query = firstParam(params.q).trim();
  const filteredCalls = filterCalls(data.recentCalls, filter, query);

  return (
    <main className="shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="brand">
          <span className="brandMark">NA</span>
          <span>NAVA</span>
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
          <a href="/calendar">
            <CalendarCheck size={18} aria-hidden /> Calendar
          </a>
          <a href="/miro">
            <MapPinned size={18} aria-hidden /> Miro
          </a>
          <a href="/compliance">
            <ShieldCheck size={18} aria-hidden /> Compliance
          </a>
        </nav>
        <div className="agentCard">
          <span className="listenOrb" />
          <strong>Nava</strong>
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
              <span className="listenOrb" /> Nava is listening
            </span>
            <button className="iconButton" aria-label="Notifications">
              <Bell size={20} aria-hidden />
            </button>
            <a className="iconButton" href={`mailto:${firstManagerEmail(data)}`} aria-label="Email manager">
              <Mail size={20} aria-hidden />
            </a>
            <span className="avatar">HW</span>
          </div>
        </header>

        {!result.ok ? (
          <section className="notice" role="status">
            <TriangleAlert size={20} aria-hidden />
            <span>{result.error}</span>
          </section>
        ) : null}

        <section className="callsToolbar">
          <form className="searchBox" action="/calls">
            <Search size={22} aria-hidden />
            <input
              name="q"
              placeholder="Search caller, phone, property"
              aria-label="Search calls"
              defaultValue={query}
            />
            <input name="filter" type="hidden" value={filter} />
          </form>
          <a className="secondaryButton" href="/calls">
            <Filter size={20} aria-hidden /> Clear
          </a>
          <button type="button" aria-disabled="true">
            <Download size={20} aria-hidden /> Export
          </button>
        </section>

        <section className="tabBar" aria-label="Call filters">
          <FilterLink active={filter === "all"} count={data.recentCalls.length} label="All" query={query} value="all" />
          <FilterLink active={filter === "qualified"} count={qualifiedCount(data)} label="Qualified" query={query} value="qualified" />
          <FilterLink active={filter === "pending"} count={pendingCount(data)} label="Pending" query={query} value="pending" />
          <FilterLink active={filter === "not-qualified"} count={notQualifiedCount(data)} label="Not qualified" query={query} value="not-qualified" />
          <FilterLink active={filter === "showings"} count={showingsBookedCount(data)} label="Showings booked" query={query} value="showings" />
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
            {filteredCalls.length > 0 ? (
              filteredCalls.map((call, index) => (
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
                    <StatusPill value={call.qualificationStatus ?? call.outcome ?? call.status} />
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
              <div className="emptyRow">No calls match the current filters.</div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function FilterLink({
  active,
  count,
  label,
  query,
  value
}: {
  active: boolean;
  count: number;
  label: string;
  query: string;
  value: CallsFilter;
}) {
  const href = callsHref(value, query);
  return (
    <a className={active ? "active" : ""} href={href}>
      {label} <b>{count}</b>
    </a>
  );
}

function RecordingPlayers({ call }: { call: DashboardData["recentCalls"][number] }) {
  const playableFiles = call.audioFiles.filter(
    (file) => file.signedUrl && file.mimeType.startsWith("audio/") && file.kind.endsWith("_wav")
  );
  const primaryFile =
    playableFiles.find((file) => file.kind === "mixed_wav") ?? playableFiles[0];

  if (!primaryFile) {
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
        <CallAudioPlayer
          label={audioLabel(primaryFile.kind)}
          meta={`${formatBytes(primaryFile.byteSize)} · high-quality call mix`}
          src={primaryFile.signedUrl ?? ""}
        />
      ) : (
        <p className="emptyState">
          This older call only has archived raw files. New calls will show one playable
          conversation track here.
        </p>
      )}
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
  const status = displayStatus(value);
  return (
    <span
      className={
        status.tone === "bad"
          ? "statusPill bad"
          : status.tone === "neutral"
            ? "statusPill neutral"
            : "statusPill"
      }
    >
      {status.label}
    </span>
  );
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

function filterCalls(
  calls: DashboardData["recentCalls"],
  filter: CallsFilter,
  query: string
): DashboardData["recentCalls"] {
  const normalizedQuery = query.toLowerCase();
  return calls.filter((call) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "qualified" && call.qualificationStatus === "yes") ||
      (filter === "pending" && !call.qualificationStatus) ||
      (filter === "not-qualified" && call.qualificationStatus === "no") ||
      (filter === "showings" && call.outcome === "showing_booked");

    if (!matchesFilter) return false;
    if (!normalizedQuery) return true;

    return [
      call.callerName,
      call.callerPhone,
      call.callerEmail,
      call.propertyAddress,
      stringValue(call.lead?.desiredMoveInDate)
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });
}

function callsFilter(value: string): CallsFilter {
  if (
    value === "qualified" ||
    value === "pending" ||
    value === "not-qualified" ||
    value === "showings"
  ) {
    return value;
  }
  return "all";
}

function callsHref(filter: CallsFilter, query: string): string {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (query) params.set("q", query);
  const search = params.toString();
  return search ? `/calls?${search}` : "/calls";
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
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

function displayStatus(value: string): { label: string; tone: "good" | "bad" | "neutral" } {
  const key = value.toLowerCase();
  if (key === "yes") return { label: "Qualified", tone: "good" };
  if (key === "debatable") return { label: "Needs review", tone: "neutral" };
  if (key === "no") return { label: "Not qualified", tone: "bad" };
  if (key === "showing_booked") return { label: "Showing booked", tone: "good" };
  if (key === "lead_created") return { label: "Lead captured", tone: "good" };
  if (key === "ended_without_lead") return { label: "Ended", tone: "neutral" };
  if (key === "transferred") return { label: "Transferred", tone: "neutral" };
  if (key === "not_a_leasing_call") return { label: "Not leasing", tone: "neutral" };
  if (key === "active") return { label: "Active", tone: "good" };
  if (key === "ending") return { label: "Wrapping up", tone: "neutral" };
  if (key === "failed") return { label: "Failed", tone: "bad" };
  return {
    label: value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
    tone: "neutral"
  };
}
