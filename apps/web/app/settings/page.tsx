import {
  CalendarCheck,
  CheckCircle2,
  FileAudio,
  Mail,
  MapPinned,
  PhoneCall,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert
} from "lucide-react";

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
          <PhoneCall size={24} aria-hidden />
          <span>Waxwing Voice Pro</span>
        </div>
        <nav>
          <a href="/">
            <CheckCircle2 size={18} aria-hidden /> Overview
          </a>
          <a href="/calls">
            <FileAudio size={18} aria-hidden /> Calls
          </a>
          <a className="active" href="/settings">
            <SlidersHorizontal size={18} aria-hidden /> Settings
          </a>
          <a href="/#calendar">
            <CalendarCheck size={18} aria-hidden /> Calendar
          </a>
          <a href="/#miro">
            <MapPinned size={18} aria-hidden /> Miro
          </a>
          <a href="/#compliance">
            <ShieldCheck size={18} aria-hidden /> Compliance
          </a>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{data.client.name}</p>
            <h1>Voice Agent Settings</h1>
            <p className="subtle">
              Control how the leasing agent sounds, greets callers, and qualifies leads.
            </p>
          </div>
          <a className="iconButton" href="mailto:alex@waxwingfactory.com" aria-label="Email support">
            <Mail size={20} aria-hidden />
          </a>
        </header>

        {!result.ok ? (
          <section className="notice" role="status">
            <TriangleAlert size={20} aria-hidden />
            <span>{result.error}</span>
          </section>
        ) : null}

        <form action={saveSettings} className="settingsForm">
          <section className="band">
            <div className="sectionHeader">
              <div>
                <h2>Voice</h2>
                <p>Choose the sound and conversational shape of the agent.</p>
              </div>
              <button type="submit">Save settings</button>
            </div>

            <div className="settingsGrid">
              <label className="field">
                <span>Agent name</span>
                <input name="agentName" defaultValue={data.settings.agentName} />
              </label>
              <label className="field">
                <span>Voice</span>
                <select name="voiceName" defaultValue={data.settings.voiceName}>
                  {data.voiceOptions.map((voice) => (
                    <option value={voice.name} key={voice.name}>
                      {voice.name} - {voice.description}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Pace</span>
                <select name="pace" defaultValue={data.settings.pace}>
                  <option value="slow">Slow</option>
                  <option value="balanced">Balanced</option>
                  <option value="fast">Fast</option>
                </select>
              </label>
              <label className="field">
                <span>Warmth</span>
                <select name="warmth" defaultValue={data.settings.warmth}>
                  <option value="reserved">Reserved</option>
                  <option value="balanced">Balanced</option>
                  <option value="warm">Warm</option>
                </select>
              </label>
            </div>
          </section>

          <section className="band">
            <div className="sectionHeader">
              <div>
                <h2>Greeting</h2>
                <p>First thing the agent says when answering.</p>
              </div>
            </div>
            <label className="field fullField">
              <span>Initial greeting</span>
              <textarea
                name="initialGreeting"
                rows={4}
                defaultValue={data.settings.initialGreeting}
              />
            </label>
          </section>

          <section className="band">
            <div className="sectionHeader">
              <div>
                <h2>Qualification Rules</h2>
                <p>Used consistently on every leasing call.</p>
              </div>
            </div>

            <div className="settingsGrid">
              <label className="field">
                <span>Minimum credit score</span>
                <input
                  name="minimumCreditScore"
                  type="number"
                  min="300"
                  max="850"
                  step="1"
                  defaultValue={data.settings.minimumCreditScore}
                />
              </label>
              <label className="field">
                <span>Income multiple of rent</span>
                <input
                  name="incomeRentMultiple"
                  type="number"
                  min="1"
                  max="6"
                  step="0.25"
                  defaultValue={data.settings.incomeRentMultiple}
                />
              </label>
            </div>

            <div className="toggleList">
              <label className="toggleRow">
                <span>
                  <strong>Auto-book showings for qualified leads</strong>
                  <small>When off, the agent collects a preferred time for office follow-up.</small>
                </span>
                <input
                  name="autoBookShowings"
                  type="checkbox"
                  value="true"
                  defaultChecked={data.settings.autoBookShowings}
                />
              </label>
              <label className="toggleRow">
                <span>
                  <strong>Ask about pets even on no-pet properties</strong>
                  <small>Usually leave off so the agent only discusses listed pet policy.</small>
                </span>
                <input
                  name="askPetsOnNoPetProperties"
                  type="checkbox"
                  value="true"
                  defaultChecked={data.settings.askPetsOnNoPetProperties}
                />
              </label>
            </div>
          </section>
        </form>
      </section>
    </main>
  );
}

async function saveSettings(formData: FormData) {
  "use server";

  const payload = {
    agentName: String(formData.get("agentName") ?? ""),
    voiceName: String(formData.get("voiceName") ?? ""),
    pace: String(formData.get("pace") ?? "balanced"),
    warmth: String(formData.get("warmth") ?? "balanced"),
    initialGreeting: String(formData.get("initialGreeting") ?? ""),
    minimumCreditScore: Number(formData.get("minimumCreditScore") ?? 600),
    incomeRentMultiple: Number(formData.get("incomeRentMultiple") ?? 3),
    autoBookShowings: formData.get("autoBookShowings") === "true",
    askPetsOnNoPetProperties: formData.get("askPetsOnNoPetProperties") === "true"
  };

  const baseUrl = process.env.API_BASE_URL ?? "http://localhost:8787";
  const url = new URL("/dashboard/settings", baseUrl);
  url.searchParams.set("client_slug", process.env.DASHBOARD_CLIENT_SLUG ?? "default");

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.DASHBOARD_API_KEY
        ? { Authorization: `Bearer ${process.env.DASHBOARD_API_KEY}` }
        : {})
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Unable to save settings. API returned ${response.status}.`);
  }

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
