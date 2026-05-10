import {
  Bell,
  CalendarCheck,
  FileAudio,
  Home,
  Mail,
  MapPinned,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert
} from "lucide-react";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

interface SettingsData {
  client: {
    name: string;
    timezone: string;
  };
  settings: AgentSettings;
  voiceOptions: Array<{
    name: string;
    description: string;
  }>;
  generatedAt: string;
}

interface AgentSettings {
  agentName: string;
  voiceName: string;
  pace: "slow" | "balanced" | "fast";
  warmth: "reserved" | "balanced" | "warm";
  initialGreeting: string;
  minimumCreditScore: number;
  incomeRentMultiple: number;
  autoBookShowings: boolean;
  askPetsOnNoPetProperties: boolean;
}

export default async function SettingsPage() {
  const result = await getSettings();
  const data = result.ok ? result.data : fallbackSettings();

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
          <a className="active" href="/settings">
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
          <strong>{data.settings.agentName}</strong>
          <small>Listening for calls</small>
          <span>{data.settings.voiceName} · {data.settings.pace}</span>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>Voice</h1>
            <p className="subtle">
              Control how the leasing agent sounds, greets callers, and qualifies leads.
            </p>
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

        {!result.ok ? (
          <section className="notice" role="status">
            <TriangleAlert size={20} aria-hidden />
            <span>{result.error}</span>
          </section>
        ) : null}

        <SettingsForm settings={data.settings} voiceOptions={data.voiceOptions} />
      </section>
    </main>
  );
}

async function getSettings(): Promise<
  | { ok: true; data: SettingsData }
  | { ok: false; error: string }
> {
  const baseUrl = process.env.API_BASE_URL ?? "http://localhost:8787";
  const url = new URL("/dashboard/settings", baseUrl);
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
        error: `Settings API returned ${response.status}. Check API_BASE_URL and DASHBOARD_API_KEY.`
      };
    }

    return { ok: true, data: (await response.json()) as SettingsData };
  } catch (error) {
    return {
      ok: false,
      error: `Settings API is unavailable: ${
        error instanceof Error ? error.message : String(error)
      }`
    };
  }
}

function fallbackSettings(): SettingsData {
  return {
    client: { name: "Waxwing Voice Pro", timezone: "America/Chicago" },
    settings: {
      agentName: "Morgan",
      voiceName: "Kore",
      pace: "balanced",
      warmth: "balanced",
      initialGreeting:
        "Hi, this is Morgan with Hunter Property Management. What property are you calling about?",
      minimumCreditScore: 600,
      incomeRentMultiple: 3,
      autoBookShowings: true,
      askPetsOnNoPetProperties: false
    },
    voiceOptions: [
      { name: "Kore", description: "Clear, professional, steady" },
      { name: "Puck", description: "Bright, energetic, friendly" },
      { name: "Aoede", description: "Warm, conversational, light" },
      { name: "Charon", description: "Calm, grounded, mature" }
    ],
    generatedAt: new Date().toISOString()
  };
}
