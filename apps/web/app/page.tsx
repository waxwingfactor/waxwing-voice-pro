import {
  Bell,
  CalendarCheck,
  ChevronRight,
  Clock3,
  FileAudio,
  Home,
  Mail,
  MapPinned,
  PhoneCall,
  ShieldCheck,
  SlidersHorizontal,
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
    lead?: Record<string, unknown>;
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
          <span className="brandMark">WV</span>
          <span>Waxwing Voice</span>
        </div>
        <p className="navSection">Workspace</p>
        <nav>
          <a className="active" href="#overview">
            <Home size={18} aria-hidden /> Dashboard
          </a>
          <a href="/calls">
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
          <span>{data.metrics.callsToday} today · v2.4</span>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>Dashboard</h1>
            <p className="subtle">Today · {formatDateTime(data.generatedAt, data.client.timezone)}</p>
          </div>
          <div className="topActions">
            <span className="listeningBadge">
              <span className="listenOrb" /> Agent is listening
            </span>
            <a className="iconButton" href={`mailto:${firstManagerEmail(data)}`} aria-label="Email manager">
              <Mail size={20} aria-hidden />
            </a>
            <button className="iconButton" aria-label="Notifications">
              <Bell size={20} aria-hidden />
            </button>
            <span className="avatar">WV</span>
          </div>
        </header>

        {!result.ok ? (
          <section className="notice" role="status">
            <TriangleAlert size={20} aria-hidden />
            <span>{result.error}</span>
          </section>
        ) : null}

        <section className="heroCard" id="overview">
          <div>
            <p>Good morning, {data.client.name}</p>
            <h2>
              The agent handled {data.metrics.callsToday} calls today —{" "}
              {data.metrics.qualifiedLeadsToday} qualified.
            </h2>
            <span>
              {data.metrics.showingsBookedToday} showing
              {data.metrics.showingsBookedToday === 1 ? "" : "s"} booked and{" "}
              {data.metrics.followUpsToday} follow-up
              {data.metrics.followUpsToday === 1 ? "" : "s"} queued.
            </span>
          </div>
          <a className="primaryButton" href="/calls">
            View all calls <ChevronRight size={20} aria-hidden />
          </a>
        </section>

        <section className="metrics" aria-label="Call metrics">
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

        <section className="dashboardGrid">
          <div className="band callTableCard" id="calls">
            <div className="sectionHeader">
              <div>
                <h2>Today&apos;s calls</h2>
                <p>
                  {data.metrics.callsToday} calls · {data.metrics.qualifiedLeadsToday} qualified ·{" "}
                  {data.metrics.showingsBookedToday} showings booked
                </p>
              </div>
              <a className="textAction" href="/calls">
                View all <ChevronRight size={18} aria-hidden />
              </a>
            </div>
            <div className="table compactTable" role="table" aria-label="Recent calls">
              <div className="row header" role="row">
                <span>Caller</span>
                <span>Property</span>
                <span>Status</span>
                <span>Tour</span>
              </div>
              {data.recentCalls.length > 0 ? (
                data.recentCalls.map((call) => (
                  <a className="row rowLink" role="row" href={`/calls/${call.id}`} key={call.id}>
                    <span className="callerCell">
                      <span className="miniAvatar">{initials(call.callerName)}</span>
                      <span>
                        <strong>{call.callerName ?? "Unknown"}</strong>
                        <small>{call.callerPhone ?? formatTime(call.startedAt, data.client.timezone)}</small>
                      </span>
                    </span>
                    <span>{call.propertyAddress ?? "Not captured"}</span>
                    <span>
                      <StatusPill value={call.qualificationStatus ?? call.outcome ?? call.status} />
                    </span>
                    <span>{showingLabel(call)}</span>
                  </a>
                ))
              ) : (
                <div className="emptyRow">No calls have been logged yet today.</div>
              )}
            </div>
          </div>

          <div className="sideStack">
            <div className="panel upcomingPanel">
              <div className="sectionHeader">
                <div>
                  <h2>Upcoming showings</h2>
                  <p>{upcomingShowings(data).length} ready for follow-up</p>
                </div>
                <CalendarCheck size={22} aria-hidden />
              </div>
              <div className="showingList">
                {upcomingShowings(data).length > 0 ? (
                  upcomingShowings(data).map((showing) => (
                    <a href={`/calls/${showing.callId}`} className="showingItem" key={showing.callId}>
                      <span>{showing.day}</span>
                      <strong>{showing.caller}</strong>
                      <small>{showing.property}</small>
                      <em>{showing.time}</em>
                    </a>
                  ))
                ) : (
                  <p className="emptyState">No showing requests captured yet today.</p>
                )}
              </div>
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
      <i className="sparkline" aria-hidden />
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  const status = displayStatus(value);
  const isBad = status.tone === "bad";
  const isNeutral = status.tone === "neutral";
  return (
    <span className={isBad ? "statusPill bad" : isNeutral ? "statusPill neutral" : "statusPill"}>
      {status.label}
    </span>
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

function upcomingShowings(data: DashboardData) {
  return data.recentCalls
    .filter((call) => call.outcome === "showing_booked" || call.showingRequested)
    .slice(0, 4)
    .map((call) => {
      const requestedTime = stringValue(call.lead?.requestedShowingTime);
      const date = requestedTime === "Not captured" ? new Date(call.startedAt) : new Date(requestedTime);
      const isValidDate = !Number.isNaN(date.getTime());
      return {
        callId: call.id,
        caller: call.callerName ?? "Unknown caller",
        property: call.propertyAddress ?? "Property not captured",
        day: isValidDate
          ? new Intl.DateTimeFormat("en-US", { timeZone: data.client.timezone, weekday: "short" }).format(date)
          : "Soon",
        time:
          requestedTime !== "Not captured" && isValidDate
            ? new Intl.DateTimeFormat("en-US", {
                timeZone: data.client.timezone,
                hour: "numeric",
                minute: "2-digit"
              }).format(date)
            : showingLabel(call)
      };
    });
}

function initials(name?: string): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join("") || "??";
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

function stringValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not captured";
  return String(value);
}
