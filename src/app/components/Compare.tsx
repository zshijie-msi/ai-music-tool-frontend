import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  Minus,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { SAVED_VERSIONS_KEY } from "../lib/creationSession";

interface SavedVersion {
  id: number;
  savedAt: string;
  card: {
    family_key: string;
    style: string;
    variant_name: string;
    preset: string;
    rhythm_advice: string;
    tone_hint: string;
    explanation: string;
  };
  settings: {
    complexity: number;
    tone: number;
    energy: number;
  };
  fingerprint: {
    register_line: string;
    density_line: string;
    motion_line: string;
    summary: string;
  };
  predictions: {
    register: string;
    density: string;
    motion: string;
  };
  melodySteps: number[];
  noteCount: number;
}

function getComplexityLabel(v: number): string {
  if (v < 0.18) return "Very Simple";
  if (v < 0.38) return "Simple";
  if (v < 0.62) return "Balanced";
  if (v < 0.82) return "Richer";
  return "Very Rich";
}

function getToneLabel(v: number): string {
  if (v < 0.18) return "Very Soft";
  if (v < 0.38) return "Soft";
  if (v < 0.62) return "Balanced";
  if (v < 0.82) return "Brighter";
  return "Very Bright";
}

function getEnergyLabel(v: number): string {
  if (v < 0.18) return "Very Stable";
  if (v < 0.38) return "Stable";
  if (v < 0.62) return "Moderate";
  if (v < 0.82) return "Active";
  return "Very Active";
}

function DeltaText({
  a,
  b,
  numA,
  numB,
}: {
  a: string;
  b: string;
  numA?: number;
  numB?: number;
}) {
  const changed = a !== b;

  if (!changed) {
    return (
      <div className="flex items-center justify-center gap-1 text-white/25">
        <Minus className="w-3 h-3" />
        <span className="text-[11px]">No change</span>
      </div>
    );
  }

  if (numA !== undefined && numB !== undefined) {
    const diff = Math.round((numB - numA) * 100);
    const isUp = diff > 0;
    const sign = diff > 0 ? "+" : "";
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-1.5 text-[11px] text-white/30">
          <span className="line-through opacity-50">{a}</span>
          <span className="text-white/15">→</span>
          <span className="text-purple-300">{b}</span>
        </div>
        <span
          className={`text-[11px] tabular-nums flex items-center gap-0.5 ${
            isUp ? "text-purple-400" : "text-blue-400"
          }`}
        >
          {isUp ? (
            <ArrowUp className="w-2.5 h-2.5" />
          ) : (
            <ArrowDown className="w-2.5 h-2.5" />
          )}
          {sign}
          {diff}%
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-1.5 text-[11px] text-white/30">
        <span className="line-through opacity-50">{a}</span>
        <span className="text-white/15">→</span>
        <span className="text-purple-300">{b}</span>
      </div>
    </div>
  );
}

function SummaryCard({
  version,
  label,
  isCurrent,
}: {
  version: SavedVersion;
  label: string;
  isCurrent?: boolean;
}) {
  return (
    <div
      className={`flex-1 rounded-xl border p-4 ${
        isCurrent
          ? "border-purple-500/25 bg-purple-500/[0.05]"
          : "border-white/[0.06] bg-white/[0.02]"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className={`text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
            isCurrent
              ? "text-purple-300/70 bg-purple-500/15 border-purple-500/20"
              : "text-white/30 bg-white/[0.04] border-white/[0.08]"
          }`}
        >
          {label}
        </span>
        <span className="text-white/25 text-[11px]">
          {version.savedAt}
        </span>
      </div>

      <p className="text-white text-[15px] mb-1">
        {version.card.style}
      </p>
      <p className="text-white/40 text-[12px] mb-2">
        {version.card.preset}
      </p>
      <p className="text-white/25 text-[11px] mb-3">
        {version.card.variant_name}
      </p>

      <div className="flex flex-wrap gap-2">
        <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.04] text-white/40 border border-white/[0.06]">
          Complexity:{" "}
          {getComplexityLabel(version.settings.complexity)}
        </span>
        <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.04] text-white/40 border border-white/[0.06]">
          Tone: {getToneLabel(version.settings.tone)}
        </span>
        <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.04] text-white/40 border border-white/[0.06]">
          Energy: {getEnergyLabel(version.settings.energy)}
        </span>
      </div>
    </div>
  );
}

export function Compare() {
  const navigate = useNavigate();
  const [versions, setVersions] = useState<SavedVersion[]>([]);

  useEffect(() => {
    const stored = JSON.parse(
      localStorage.getItem(SAVED_VERSIONS_KEY) || "[]",
    );
    setVersions(stored);
  }, []);

  if (versions.length < 2) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center px-6">
        <p className="text-white/50 text-[15px] mb-3">
          You need at least 2 saved versions to compare.
        </p>
        <p className="text-white/25 text-[13px] mb-6 text-center max-w-md">
          Save one draft, refine it again, save another one, and
          then come back here.
        </p>
        <button
          onClick={() => navigate("/result")}
          className="px-5 py-2.5 rounded-lg bg-white text-[#0a0a0f] hover:bg-white/90 transition cursor-pointer text-[14px]"
        >
          Back to result
        </button>
      </div>
    );
  }

  const previous = versions[versions.length - 2];
  const current = versions[versions.length - 1];

  const rows = [
    {
      label: "Style",
      a: previous.card.style,
      b: current.card.style,
    },
    {
      label: "Preset",
      a: previous.card.preset,
      b: current.card.preset,
    },
    {
      label: "Rhythm advice",
      a: previous.card.rhythm_advice,
      b: current.card.rhythm_advice,
    },
    {
      label: "Tone hint",
      a: previous.card.tone_hint,
      b: current.card.tone_hint,
    },
    {
      label: "Complexity",
      a: getComplexityLabel(previous.settings.complexity),
      b: getComplexityLabel(current.settings.complexity),
      numA: previous.settings.complexity,
      numB: current.settings.complexity,
    },
    {
      label: "Tone",
      a: getToneLabel(previous.settings.tone),
      b: getToneLabel(current.settings.tone),
      numA: previous.settings.tone,
      numB: current.settings.tone,
    },
    {
      label: "Energy",
      a: getEnergyLabel(previous.settings.energy),
      b: getEnergyLabel(current.settings.energy),
      numA: previous.settings.energy,
      numB: current.settings.energy,
    },
  ];

  const changedCount = rows.filter((r) => r.a !== r.b).length;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white px-6 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <button
            onClick={() => navigate("/result")}
            className="flex items-center gap-2 text-white/40 hover:text-white/70 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-[13px]">Back</span>
          </button>

          <div className="text-white/30 text-[13px]">
            Comparing your last 2 saved versions
          </div>
        </div>

        <div className="mb-8">
          <h1 className="text-white text-[28px] tracking-tight mb-2">
            Compare versions
          </h1>
          <p className="text-white/40 text-[15px]">
            {changedCount} differences found between your last
            two saved drafts.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <SummaryCard version={previous} label="Previous" />
          <SummaryCard
            version={current}
            label="Current"
            isCurrent
          />
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden mb-8">
          {rows.map((row, idx) => (
            <div
              key={row.label}
              className={`grid grid-cols-[120px_1fr] md:grid-cols-[160px_1fr] gap-4 px-4 py-4 ${
                idx !== rows.length - 1
                  ? "border-b border-white/[0.06]"
                  : ""
              }`}
            >
              <div className="text-white/30 text-[12px] uppercase tracking-wider pt-1">
                {row.label}
              </div>
              <div className="min-h-[32px] flex items-center justify-center">
                <DeltaText
                  a={row.a}
                  b={row.b}
                  numA={row.numA}
                  numB={row.numB}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 mb-8">
          <p className="text-white/25 text-[11px] uppercase tracking-wider mb-2">
            Fingerprint summary
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-white/20 text-[10px] uppercase tracking-wider mb-1">
                Previous
              </p>
              <p className="text-white/45 text-[13px]">
                {previous.fingerprint.summary}
              </p>
            </div>
            <div>
              <p className="text-white/20 text-[10px] uppercase tracking-wider mb-1">
                Current
              </p>
              <p className="text-white/45 text-[13px]">
                {current.fingerprint.summary}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => navigate("/refine")}
            className="px-5 py-2.5 rounded-lg bg-white text-[#0a0a0f] hover:bg-white/90 transition cursor-pointer text-[14px]"
          >
            Make another version
          </button>

          <button
            onClick={() => navigate("/result")}
            className="px-5 py-2.5 rounded-lg border border-white/[0.08] text-white/50 hover:text-white/80 hover:border-white/20 transition cursor-pointer text-[14px]"
          >
            Back to current draft
          </button>
        </div>
      </div>
    </div>
  );
}