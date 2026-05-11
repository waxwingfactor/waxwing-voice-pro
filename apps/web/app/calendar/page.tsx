import {
  Bell,
  CalendarCheck,
  FileAudio,
  Home,
  Mail,
  MapPinned,
  ShieldCheck,
  SlidersHorizontal
} from "lucide-react";

export const dynamic = "force-dynamic";

interface DashboardData {
  client: {
    name: string;
    timezone: string;
    managerEmails?: string[];
  };
  recentCalls: Array<{
    id: string;
    startedAt: string;
    outcome?: string;
    callerName?: string;
    propertyAddress?: string;
    showingRequested: boolean;
    lead?: Record<string, unknown>;
  }>;
  generatedAt: string;
}

export default async function CalendarPage() {
  const result = await getDashboard();
  const data = result.ok ? result.data : fallbackDashboard();
  const days = calendarDays(data);

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
          <a href="/calls">
            <FileAudio size={18} aria-hidden /> Calls
          </a>
          <a href="/settings">
            <SlidersHorizontal size={18} aria-hidden /> Settings
          </a>
        </nav>
        <p className="navSection">Configure</p>
        <nav>
          <a className="active" href="/calendar">
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
          <span>Calendar booking</span>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>Calendar</h1>
            <p className="subtle">Review the Google Calendar connection used for showing availability.</p>
          </div>
          <div className="topActions">
            <span className="listeningBadge">
              <span className="listenOrb" /> Nava is listening
            </span>
            <button className="iconButton" aria-label="Notifications">
              <Bell size={20} aria-hidden />
            </button>
            <a className="iconButton" href="mailto:alex@waxwingfactory.com" aria-label="Email support">
              <Mail size={20} aria-hidden />
            </a>
            <span className="avatar">HW</span>
          </div>
        </header>

        <section className="calendarLayout">
          <div className="band calendarBoard">
            <div className="sectionHeader">
              <div>
                <h2>Showing calendar</h2>
                <p>Booked and requested tours from recent voice-agent calls.</p>
              </div>
              <CalendarCheck size={24} aria-hidden />
            </div>
            <div className="calendarGrid" role="list" aria-label="Upcoming showing calendar">
              {days.map((day) => (
                <section className="calendarDay" key={day.key} role="listitem">
                  <span>{day.weekday}</span>
                  <strong>{day.date}</strong>
                  <div>
                    {day.items.length > 0 ? (
                      day.items.map((item) => (
                        <a href={`/calls/${item.callId}`} className="calendarEvent" key={item.callId}>
                          <b>{item.time}</b>
                          <small>{item.caller}</small>
                          <em>{item.property}</em>
                        </a>
                      ))
                    ) : (
                      <p>No tours</p>
                    )}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <div className="panel">
            <h2>Connection</h2>
            <p>
              To reconnect a calendar, open the deployed API OAuth start URL and approve the
              requested calendar scopes with the property manager account.
            </p>
            <a className="primaryButton" href="/settings">
              Review agent settings
            </a>
          </div>
        </section>
      </section>
    </main>
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
      return { ok: false, error: `Dashboard API returned ${response.status}.` };
    }

    return { ok: true, data: (await response.json()) as DashboardData };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function fallbackDashboard(): DashboardData {
  return {
    client: { name: "Waxwing Voice Pro", timezone: "America/Chicago" },
    recentCalls: [],
    generatedAt: new Date().toISOString()
  };
}

function calendarDays(data: DashboardData) {
  const start = new Date(data.generatedAt);
  start.setHours(0, 0, 0, 0);
  const events = data.recentCalls
    .filter((call) => call.outcome === "showing_booked" || call.showingRequested)
    .map((call) => {
      const requested = stringValue(call.lead?.requestedShowingTime);
      const eventDate = requested === "Not captured" ? new Date(call.startedAt) : new Date(requested);
      return {
        callId: call.id,
        date: Number.isNaN(eventDate.getTime()) ? new Date(call.startedAt) : eventDate,
        caller: call.callerName ?? "Unknown caller",
        property: call.propertyAddress ?? "Property not captured"
      };
    });

  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    const items = events
      .filter((event) => event.date.toISOString().slice(0, 10) === key)
      .map((event) => ({
        ...event,
        time: new Intl.DateTimeFormat("en-US", {
          timeZone: data.client.timezone,
          hour: "numeric",
          minute: "2-digit"
        }).format(event.date)
      }));

    return {
      key,
      weekday: new Intl.DateTimeFormat("en-US", {
        timeZone: data.client.timezone,
        weekday: "short"
      }).format(date),
      date: new Intl.DateTimeFormat("en-US", {
        timeZone: data.client.timezone,
        month: "short",
        day: "numeric"
      }).format(date),
      items
    };
  });
}

function stringValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not captured";
  return String(value);
}
