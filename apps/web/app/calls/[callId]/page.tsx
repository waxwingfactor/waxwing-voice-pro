import {
  ArrowLeft,
  Bell,
  CalendarCheck,
  ClipboardList,
  Download,
  FileAudio,
  Home,
  Mail,
  MapPinned,
  MessageSquareText,
  PhoneCall,
  PlayCircle,
  ShieldCheck,
  SlidersHorizontal,
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
          <strong>Voice agent</strong>
          <small>Listening for calls</small>
          <span>Call review · v2.4</span>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <a className="backLink" href="/calls">
              <ArrowLeft size={16} aria-hidden />
              All calls
            </a>
            <h1>Call detail</h1>
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

        <section className="callHero">
          <span className="largeAvatar">{initials(call.callerName)}</span>
          <div>
            <h2>{call.callerName ?? "Unknown caller"}</h2>
            <p>
              {call.callerPhone ?? "No phone captured"} ·{" "}
              {formatDateTime(call.startedAt, data.client.timezone)} · {call.id}
            </p>
          </div>
          <StatusPill value={call.qualificationStatus ?? call.outcome ?? call.status} />
          <div className="callHeroActions">
            <a className="secondaryButton" href={primaryAudioUrl(call) ?? "#"}>
              <Download size={18} aria-hidden /> Download
            </a>
            <a className="primaryButton" href={`tel:${call.callerPhone ?? ""}`}>
              <PhoneCall size={18} aria-hidden /> Call back
            </a>
          </div>
        </section>

        <section className="recordingHero detailBlock">
          <RecordingPlayers call={call} />
        </section>

        <section className="callDetailGrid singleCallDetail">
            <section className="detailBlock transcriptBlock" aria-label="Structured transcript">
              <div className="blockTitle">
                <MessageSquareText size={18} aria-hidden />
                <h3>Transcript</h3>
                <span className="pill">{call.transcript.length} turns</span>
              </div>
              <Transcript call={call} timezone={data.client.timezone} />
            </section>

            <section className="detailBlock capturedPanel" aria-label="Captured call information">
              <div className="blockTitle">
                <ClipboardList size={18} aria-hidden />
                <h3>Captured Info</h3>
                <span className="scoreRing">{leadScore(call)}</span>
              </div>
              <CapturedInfo call={call} />
            </section>
        </section>
      </section>
    </main>
  );
}

function RecordingPlayers({ call }: { call: DashboardCall }) {
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
        <div className="audioTrack primaryAudioTrack">
          <div>
            <span className="playBubble">
              <PlayCircle size={36} aria-hidden />
            </span>
            <strong>{audioLabel(primaryFile.kind)}</strong>
            <span>{formatBytes(primaryFile.byteSize)}</span>
          </div>
          <div className="waveform" aria-hidden>
            {Array.from({ length: 80 }).map((_, index) => (
              <i key={index} style={{ "--h": `${24 + ((index * 17) % 58)}%` } as React.CSSProperties} />
            ))}
          </div>
          <audio controls preload="none" src={primaryFile.signedUrl} />
        </div>
      ) : (
        <p className="emptyState">
          This older call only has archived raw files. New calls will show one playable
          conversation track here.
        </p>
      )}
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
    { label: "Email", value: stringValue(call.callerEmail ?? lead.callerEmail) },
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

function leadScore(call: DashboardCall): number {
  if (call.qualification?.qualifiedToApply === "yes") return 92;
  if (call.qualification?.qualifiedToApply === "debatable") return 63;
  if (call.qualification?.qualifiedToApply === "no") return 28;
  return call.showingRequested ? 78 : 50;
}

function primaryAudioUrl(call: DashboardCall): string | undefined {
  return (
    call.audioFiles.find((file) => file.kind === "mixed_wav" && file.signedUrl)?.signedUrl ??
    call.audioFiles.find((file) => file.signedUrl)?.signedUrl
  );
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

function firstManagerEmail(data: CallDetailData): string {
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
