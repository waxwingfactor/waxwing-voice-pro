import {
  CalendarCheck,
  CheckCircle2,
  FileAudio,
  Mail,
  MapPinned,
  PhoneCall,
  ShieldCheck,
  TriangleAlert
} from "lucide-react";

const calls = [
  {
    id: "01HXCALL7ZH3",
    caller: "Jessica M.",
    property: "152 Navarro Crossing",
    status: "Qualified",
    showing: "Booked",
    time: "9:42 AM"
  },
  {
    id: "01HXCALL82AF",
    caller: "Unknown",
    property: "109 Clear Water",
    status: "Needs follow-up",
    showing: "Requested",
    time: "10:18 AM"
  },
  {
    id: "01HXCALL8K9Q",
    caller: "Maintenance",
    property: "No property",
    status: "Transferred",
    showing: "None",
    time: "11:03 AM"
  }
];

export default function DashboardPage() {
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
            <p className="eyebrow">Hunter Property Management</p>
            <h1>Leasing Voice Operations</h1>
          </div>
          <button type="button" className="iconButton" aria-label="Send test email">
            <Mail size={20} aria-hidden />
          </button>
        </header>

        <section className="metrics" id="overview" aria-label="Call metrics">
          <Metric icon={<PhoneCall size={20} />} label="Calls today" value="18" />
          <Metric icon={<CheckCircle2 size={20} />} label="Qualified leads" value="7" />
          <Metric icon={<CalendarCheck size={20} />} label="Showings booked" value="4" />
          <Metric icon={<TriangleAlert size={20} />} label="Knowledge gaps" value="3" />
        </section>

        <section className="band" id="calls">
          <div className="sectionHeader">
            <div>
              <h2>Recent Calls</h2>
              <p>Structured logs, transcripts, raw audio, and post-call delivery status.</p>
            </div>
            <button type="button">Export</button>
          </div>
          <div className="table" role="table" aria-label="Recent calls">
            <div className="row header" role="row">
              <span>Time</span>
              <span>Caller</span>
              <span>Property</span>
              <span>Status</span>
              <span>Showing</span>
            </div>
            {calls.map((call) => (
              <div className="row" role="row" key={call.id}>
                <span>{call.time}</span>
                <span>{call.caller}</span>
                <span>{call.property}</span>
                <span>{call.status}</span>
                <span>{call.showing}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="split">
          <div className="panel" id="calendar">
            <h2>Connection Health</h2>
            <ul className="statusList">
              <li>
                <CheckCircle2 size={18} aria-hidden />
                Twilio number connected
              </li>
              <li>
                <CheckCircle2 size={18} aria-hidden />
                Resend domain verified
              </li>
              <li>
                <TriangleAlert size={18} aria-hidden />
                Google Calendar needs client OAuth
              </li>
              <li>
                <TriangleAlert size={18} aria-hidden />
                Miro board token pending
              </li>
            </ul>
          </div>

          <div className="panel" id="compliance">
            <h2>Fair Housing Guardrails</h2>
            <p>
              The agent uses the same rental criteria for each interested caller and blocks
              protected-class-sensitive steering or approval promises.
            </p>
            <div className="callout">
              <ShieldCheck size={22} aria-hidden />
              <span>0 unresolved compliance review items today</span>
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
