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

export default function MiroPage() {
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
          <a href="/calendar">
            <CalendarCheck size={18} aria-hidden /> Calendar
          </a>
          <a className="active" href="/miro">
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
          <span>Miro summaries</span>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>Miro</h1>
            <p className="subtle">Call outcomes can be turned into clean visual summaries on a Miro board.</p>
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

        <section className="dashboardGrid">
          <div className="band">
            <div className="sectionHeader">
              <div>
                <h2>Board export</h2>
                <p>Each call can create a compact lead card with summary, captured fields, and one audio link.</p>
              </div>
              <MapPinned size={24} aria-hidden />
            </div>
            <ul className="statusList">
              <li>Long transcripts are kept in a dedicated document area to avoid overlapping notes.</li>
              <li>The board uses one conversation recording link, not separate raw audio files.</li>
              <li>Exports are meant for client review, handoff, and weekly leasing retrospectives.</li>
            </ul>
          </div>

          <div className="panel">
            <h2>Setup</h2>
            <p>
              Add the Miro access token and board id in Render. Then the post-call worker can create
              the visual call summary after each completed call.
            </p>
            <a className="secondaryButton" href="/calls">
              Review recent calls
            </a>
          </div>
        </section>
      </section>
    </main>
  );
}
