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

export default function CompliancePage() {
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
          <a href="/miro">
            <MapPinned size={18} aria-hidden /> Miro
          </a>
          <a className="active" href="/compliance">
            <ShieldCheck size={18} aria-hidden /> Compliance
          </a>
        </nav>
        <div className="agentCard">
          <span className="listenOrb" />
          <strong>Nava</strong>
          <small>Listening for calls</small>
          <span>Fair housing guardrails</span>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>Compliance</h1>
            <p className="subtle">Guardrails for fair, consistent leasing conversations.</p>
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
                <h2>Leasing rules</h2>
                <p>The agent qualifies based on configurable financial criteria only.</p>
              </div>
              <ShieldCheck size={24} aria-hidden />
            </div>
            <ul className="statusList">
              <li>No decisions are made from protected-class information.</li>
              <li>Qualification questions stay limited to credit, income, co-signer, and deposit options.</li>
              <li>Unclear or sensitive requests are escalated to a human property manager.</li>
            </ul>
          </div>

          <div className="panel">
            <h2>Review workflow</h2>
            <p>
              Every call is logged with transcript, captured fields, outcome, timestamp, and the
              conversation recording so disputed or sensitive interactions can be reviewed.
            </p>
            <a className="primaryButton" href="/calls">
              Open call log
            </a>
          </div>
        </section>
      </section>
    </main>
  );
}
