import {
  CalendarCheck,
  CheckCircle2,
  Clock3,
  FileAudio,
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
          <a href="/calls">
            <FileAudio size={18} aria-hidden /> Calls
          </a>
          <a href="/settings">
            <SlidersHorizontal size={18} aria-hidden /> Settings
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
              <h2>Recent Calls</h2>
              <p>Essential call activity from today.</p>
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
                <a className="row rowLink" role="row" href={`/calls/${call.id}`} key={call.id}>
                  <span>{formatTime(call.startedAt, data.client.timezone)}</span>
                  <span title={call.callerPhone}>{call.callerName ?? "Unknown"}</span>
                  <span>{call.propertyAddress ?? "Not captured"}</span>
                  <span>{call.qualificationStatus ?? call.outcome ?? call.status}</span>
                  <span>{showingLabel(call)}</span>
                </a>
              ))
            ) : (
              <div className="emptyRow">No calls have been logged yet today.</div>
            )}
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

function firstManagerEmail(data: DashboardData): string {
  return data.client.managerEmails?.[0] ?? "alex@waxwingfactory.com";
}
