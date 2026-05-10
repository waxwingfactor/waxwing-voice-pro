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

export default function CalendarPage() {
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
          <strong>Voice agent</strong>
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
              <span className="listenOrb" /> Agent is listening
            </span>
            <button className="iconButton" aria-label="Notifications">
              <Bell size={20} aria-hidden />
            </button>
            <a className="iconButton" href="mailto:alex@waxwingfactory.com" aria-label="Email support">
              <Mail size={20} aria-hidden />
            </a>
            <span className="avatar">WV</span>
          </div>
        </header>

        <section className="dashboardGrid">
          <div className="band">
            <div className="sectionHeader">
              <div>
                <h2>Showing availability</h2>
                <p>The voice agent checks free/busy windows before offering showing times.</p>
              </div>
              <CalendarCheck size={24} aria-hidden />
            </div>
            <ul className="statusList">
              <li>Calendar OAuth connection is stored in Supabase.</li>
              <li>Only booked events are written to the property manager calendar.</li>
              <li>Callers receive an email confirmation when a showing is booked.</li>
            </ul>
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
