"use client";

import { Mic2 } from "lucide-react";
import { useState } from "react";

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

interface VoiceOption {
  name: string;
  description: string;
}

export function SettingsForm({
  settings,
  voiceOptions
}: {
  settings: AgentSettings;
  voiceOptions: VoiceOption[];
}) {
  const [current, setCurrent] = useState(settings);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  async function saveSettings(formData: FormData) {
    setSaveState("saving");
    setError("");
    const payload: AgentSettings = {
      agentName: String(formData.get("agentName") ?? ""),
      voiceName: String(formData.get("voiceName") ?? current.voiceName),
      pace: option(formData.get("pace"), ["slow", "balanced", "fast"], "balanced"),
      warmth: option(formData.get("warmth"), ["reserved", "balanced", "warm"], "balanced"),
      initialGreeting: String(formData.get("initialGreeting") ?? ""),
      minimumCreditScore: Number(formData.get("minimumCreditScore") ?? 600),
      incomeRentMultiple: Number(formData.get("incomeRentMultiple") ?? 3),
      autoBookShowings: formData.get("autoBookShowings") === "true",
      askPetsOnNoPetProperties: formData.get("askPetsOnNoPetProperties") === "true"
    };

    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = await response.text();
      setError(body || `Settings API returned ${response.status}.`);
      setSaveState("error");
      return;
    }

    const data = (await response.json()) as { settings?: AgentSettings };
    setCurrent(data.settings ?? (payload as AgentSettings));
    setSaveState("saved");
  }

  return (
    <form action={saveSettings} className="settingsForm">
      <div className="settingsSaveBar">
        <div>
          <strong>Agent settings</strong>
          <span>
            {saveState === "saving"
              ? "Saving changes..."
              : saveState === "saved"
                ? "Saved. Future calls will use these settings."
                : saveState === "error"
                  ? error
                  : "Changes apply to future calls after the API reloads them."}
          </span>
        </div>
        <button type="submit" disabled={saveState === "saving"}>
          {saveState === "saving" ? "Saving..." : "Save settings"}
        </button>
      </div>

      <section className="voiceGrid">
        {voiceOptions.map((voice, index) => (
          <label
            className={voice.name === current.voiceName ? "voiceCard selected" : "voiceCard"}
            key={voice.name}
          >
            <input
              name="voiceName"
              type="radio"
              value={voice.name}
              checked={voice.name === current.voiceName}
              onChange={() => setCurrent((value) => ({ ...value, voiceName: voice.name }))}
            />
            <span className={`voiceIcon tone${index % 6}`}>
              <Mic2 size={30} aria-hidden />
            </span>
            <span>
              <strong>{voice.name}</strong>
              <small>{voice.description}</small>
            </span>
            <span className="voiceAction">
              {voice.name === current.voiceName ? "Active" : "Select"}
            </span>
          </label>
        ))}
      </section>

      <section className="band">
        <div className="sectionHeader">
          <div>
            <h2>Customize tone</h2>
            <p>Fine-tune how {current.agentName} speaks on every call.</p>
          </div>
        </div>

        <div className="settingsGrid">
          <label className="field">
            <span>Agent name</span>
            <input
              name="agentName"
              value={current.agentName}
              onChange={(event) =>
                setCurrent((value) => ({ ...value, agentName: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>Pace</span>
            <select
              name="pace"
              value={current.pace}
              onChange={(event) =>
                setCurrent((value) => ({
                  ...value,
                  pace: event.target.value as AgentSettings["pace"]
                }))
              }
            >
              <option value="slow">Slow</option>
              <option value="balanced">Balanced</option>
              <option value="fast">Fast</option>
            </select>
          </label>
          <label className="field">
            <span>Warmth</span>
            <select
              name="warmth"
              value={current.warmth}
              onChange={(event) =>
                setCurrent((value) => ({
                  ...value,
                  warmth: event.target.value as AgentSettings["warmth"]
                }))
              }
            >
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
            value={current.initialGreeting}
            onChange={(event) =>
              setCurrent((value) => ({ ...value, initialGreeting: event.target.value }))
            }
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
              value={current.minimumCreditScore}
              onChange={(event) =>
                setCurrent((value) => ({
                  ...value,
                  minimumCreditScore: Number(event.target.value)
                }))
              }
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
              value={current.incomeRentMultiple}
              onChange={(event) =>
                setCurrent((value) => ({
                  ...value,
                  incomeRentMultiple: Number(event.target.value)
                }))
              }
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
              checked={current.autoBookShowings}
              onChange={(event) =>
                setCurrent((value) => ({ ...value, autoBookShowings: event.target.checked }))
              }
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
              checked={current.askPetsOnNoPetProperties}
              onChange={(event) =>
                setCurrent((value) => ({
                  ...value,
                  askPetsOnNoPetProperties: event.target.checked
                }))
              }
            />
          </label>
        </div>
      </section>
    </form>
  );
}

function option<T extends string>(value: FormDataEntryValue | null, options: T[], fallback: T): T {
  return typeof value === "string" && options.includes(value as T) ? (value as T) : fallback;
}
