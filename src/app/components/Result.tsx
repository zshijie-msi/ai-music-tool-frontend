import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  Save,
  GitCompare,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Layers3,
  ArrowUpDown,
  SlidersHorizontal,
} from "lucide-react";
import {
  getCreationSession,
  SAVED_VERSIONS_KEY,
} from "../lib/creationSession";
import {
  playDraftPreview,
  stopDraftPreview,
  type CoCreationControls,
} from "../lib/previewAudio";

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

function getEnergyLabel(v: number) {
  if (v < 0.18) return "Very Stable";
  if (v < 0.38) return "Stable";
  if (v < 0.62) return "Moderate";
  if (v < 0.82) return "Active";
  return "Very Active";
}

function formatPercent(v: number) {
  return `${Math.round(v * 100)}%`;
}

function SegmentedControl<T extends string>({
  label,
  icon,
  value,
  options,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-md bg-white/[0.05] flex items-center justify-center text-white/35">
          {icon}
        </div>
        <p className="text-white/65 text-[13px]">{label}</p>
      </div>

      <div className="grid grid-cols-3 gap-2 items-stretch">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={`w-full flex items-center justify-center text-center px-3 py-1.5 rounded-lg text-[12px] border transition cursor-pointer ${selected ? "bg-white text-[#0a0a0f] border-white" : "bg-white/[0.03] text-white/45 border-white/[0.08] hover:text-white/75 hover:border-white/20"} text-center`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Result() {
  const navigate = useNavigate();
  const session = getCreationSession();
  const analysis = session.analysis;
  const selectedCard = session.selection.selectedCard;
  const settings = session.refine;

  const [playing, setPlaying] = useState(false);
  const [saved, setSaved] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playError, setPlayError] = useState<string | null>(
    null,
  );
  const [previewDurationMs, setPreviewDurationMs] = useState(0);

  const [controls, setControls] = useState<CoCreationControls>({
    supportAmount: "balanced",
    supportRegister: "balanced",
    instrumentColor: "balanced",
  });

  const progressIntervalRef = useRef<number | null>(null);
  const progressStartRef = useRef<number>(0);

  const waveformBars = useMemo(
    () =>
      Array.from({ length: 60 }).map((_, i) => ({
        height:
          12 +
          Math.sin(i * 0.42) * 16 +
          Math.sin(i * 0.16) * 8 +
          6,
      })),
    [],
  );

  const clearProgressTimer = () => {
    if (progressIntervalRef.current !== null) {
      window.clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  const stopPlayback = () => {
    stopDraftPreview();
    clearProgressTimer();
    setPlaying(false);
  };

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, []);

  useEffect(() => {
    setSaved(false);
    if (playing) {
      stopPlayback();
      setProgress(0);
    }
  }, [
    controls.supportAmount,
    controls.supportRegister,
    controls.instrumentColor,
  ]);

  if (!analysis || !selectedCard) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center px-6">
        <p className="text-white/50 text-[15px] mb-3">
          No draft context found.
        </p>
        <p className="text-white/25 text-[13px] mb-6 text-center max-w-md">
          Go back, analyze a melody, choose a direction, and
          refine it first.
        </p>
        <button
          onClick={() => navigate("/melody")}
          className="px-5 py-2.5 rounded-lg bg-white text-[#0a0a0f] hover:bg-white/90 transition cursor-pointer text-[14px]"
        >
          Back to melody
        </button>
      </div>
    );
  }

  const startPlayback = () => {
    setPlayError(null);
    stopPlayback();
    setProgress(0);

    try {
      const result = playDraftPreview({
        melodySteps: session.melodyInput.melodySteps,
        card: selectedCard,
        settings,
        controls,
      });

      setPreviewDurationMs(result.durationMs);
      setPlaying(true);
      progressStartRef.current = Date.now();

      progressIntervalRef.current = window.setInterval(() => {
        const elapsed = Date.now() - progressStartRef.current;
        const nextProgress = Math.min(
          100,
          (elapsed / result.durationMs) * 100,
        );
        setProgress(nextProgress);

        if (nextProgress >= 100) {
          clearProgressTimer();
          setPlaying(false);
        }
      }, 40);
    } catch (error) {
      console.error(error);
      setPlayError(
        error instanceof Error
          ? error.message
          : "Failed to play preview.",
      );
      stopPlayback();
      setProgress(0);
    }
  };

  const togglePlay = () => {
    if (playing) {
      stopPlayback();
      return;
    }
    startPlayback();
  };

  const handleReset = () => {
    stopPlayback();
    setProgress(0);
    setPlayError(null);
  };

  const handleSave = () => {
    const existing = JSON.parse(
      localStorage.getItem(SAVED_VERSIONS_KEY) || "[]",
    );

    const version = {
      id: Date.now(),
      savedAt: new Date().toLocaleString(),
      card: {
        family_key: selectedCard.family_key,
        style: selectedCard.style,
        variant_name: selectedCard.variant_name,
        preset: selectedCard.preset,
        rhythm_advice: selectedCard.rhythm_advice,
        tone_hint: selectedCard.tone_hint,
        explanation: selectedCard.explanation,
      },
      settings: {
        complexity: settings.complexity,
        tone: settings.tone,
        energy: settings.energy,
      },
      coCreation: {
        supportAmount: controls.supportAmount,
        supportRegister: controls.supportRegister,
        instrumentColor: controls.instrumentColor,
      },
      fingerprint: analysis.fingerprint,
      predictions: analysis.predictions,
      melodySteps: session.melodyInput.melodySteps,
      noteCount: session.melodyInput.pianoRollNotes.length,
      previewMeta: {
        playable: true,
        durationMs: previewDurationMs || null,
      },
    };

    localStorage.setItem(
      SAVED_VERSIONS_KEY,
      JSON.stringify([...existing, version]),
    );

    setSaved(true);
  };

  const totalSeconds = previewDurationMs
    ? Math.max(1, Math.round(previewDurationMs / 1000))
    : 6;

  const elapsedSeconds = Math.floor(
    (progress / 100) * totalSeconds,
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <button
            onClick={() => navigate("/refine")}
            className="flex items-center gap-2 text-white/40 hover:text-white/70 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-[13px]">Back</span>
          </button>

          <div className="flex items-center gap-2 text-white/30 text-[13px]">
            <div className="w-2 h-2 rounded-full bg-cyan-400" />
            Step 4 of 4
          </div>
        </div>

        <div className="mb-8">
          <h1 className="text-white text-[28px] tracking-tight mb-2">
            Draft result
          </h1>
          <p className="text-white/40 text-[15px]">
            Your melody stays locked. These controls let you
            keep co-creating the AI support layer.
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 mb-6">
          <div className="flex items-start justify-between gap-6 mb-6">
            <div>
              <p className="text-white text-[20px] mb-1">
                {selectedCard.style}
              </p>
              <p className="text-white/30 text-[13px]">
                {selectedCard.variant_name}
              </p>
            </div>

            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/[0.04] text-white/30 border border-white/[0.08]">
              current draft
            </span>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white/70 text-[14px]">
                  Playable draft preview
                </p>
                <p className="text-white/25 text-[12px] mt-1">
                  Locked melody + co-created AI support layer
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={togglePlay}
                  className="w-10 h-10 rounded-full bg-white text-[#0a0a0f] flex items-center justify-center hover:bg-white/90 transition cursor-pointer"
                >
                  {playing ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4 ml-0.5" />
                  )}
                </button>

                <button
                  onClick={handleReset}
                  className="w-10 h-10 rounded-full border border-white/[0.08] text-white/50 hover:text-white/80 hover:border-white/20 transition flex items-center justify-center cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-end gap-1 h-24 mb-4">
              {waveformBars.map((bar, i) => {
                const active =
                  i / waveformBars.length <= progress / 100;
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-full transition-all ${
                      active
                        ? "bg-purple-400/70"
                        : "bg-white/[0.06]"
                    }`}
                    style={{ height: `${bar.height}px` }}
                  />
                );
              })}
            </div>

            <div className="w-full h-1.5 rounded-full bg-white/[0.05] overflow-hidden mb-3">
              <div
                className="h-full bg-purple-400/70 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-white/25 text-[12px]">
              <span>
                0:{String(elapsedSeconds).padStart(2, "0")}
              </span>
              <span>
                0:{String(totalSeconds).padStart(2, "0")}
              </span>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <span className="flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300/70 border border-purple-500/15">
                <Volume2 className="w-3 h-3" />
                Live browser audio
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300/70 border border-blue-500/15">
                Melody locked
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300/70 border border-emerald-500/15">
                Family:{" "}
                {selectedCard.family_key?.replaceAll("_", " ")}
              </span>
            </div>

            {playError && (
              <p className="text-red-300/80 text-[12px] mt-4">
                {playError}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 mb-5">
            <div className="mb-4">
              <p className="text-white text-[16px] mb-1">
                Co-create the support layer
              </p>
              <p className="text-white/30 text-[13px]">
                These controls change the AI arrangement around
                your melody, not the melody itself.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SegmentedControl
                label="Support amount"
                icon={<Layers3 className="w-3.5 h-3.5" />}
                value={controls.supportAmount}
                options={[
                  { value: "less", label: "Less" },
                  { value: "balanced", label: "Balanced" },
                  { value: "more", label: "More" },
                ]}
                onChange={(v) =>
                  setControls((prev) => ({
                    ...prev,
                    supportAmount: v,
                  }))
                }
              />

              <SegmentedControl
                label="Support register"
                icon={<ArrowUpDown className="w-3.5 h-3.5" />}
                value={controls.supportRegister}
                options={[
                  { value: "lower", label: "Lower" },
                  { value: "balanced", label: "Balanced" },
                  { value: "higher", label: "Higher" },
                ]}
                onChange={(v) =>
                  setControls((prev) => ({
                    ...prev,
                    supportRegister: v,
                  }))
                }
              />

              <SegmentedControl
                label="Instrument color"
                icon={
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                }
                value={controls.instrumentColor}
                options={[
                  { value: "softer", label: "Softer" },
                  { value: "balanced", label: "Balanced" },
                  { value: "brighter", label: "Brighter" },
                ]}
                onChange={(v) =>
                  setControls((prev) => ({
                    ...prev,
                    instrumentColor: v,
                  }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-white/25 text-[11px] uppercase tracking-wider mb-2">
                Direction details
              </p>
              <div className="space-y-2">
                <div>
                  <p className="text-white/20 text-[10px] uppercase tracking-wider mb-1">
                    Preset
                  </p>
                  <p className="text-white/65 text-[13px]">
                    {selectedCard.preset}
                  </p>
                </div>
                <div>
                  <p className="text-white/20 text-[10px] uppercase tracking-wider mb-1">
                    Rhythm advice
                  </p>
                  <p className="text-white/65 text-[13px]">
                    {selectedCard.rhythm_advice}
                  </p>
                </div>
                <div>
                  <p className="text-white/20 text-[10px] uppercase tracking-wider mb-1">
                    Tone hint
                  </p>
                  <p className="text-white/65 text-[13px]">
                    {selectedCard.tone_hint}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-white/25 text-[11px] uppercase tracking-wider mb-2">
                Melody fingerprint
              </p>
              <p className="text-white/50 text-[13px] leading-relaxed mb-2">
                {analysis.fingerprint.summary}
              </p>
              <p className="text-white/30 text-[12px]">
                {analysis.fingerprint.register_line}
              </p>
              <p className="text-white/30 text-[12px]">
                {analysis.fingerprint.density_line}
              </p>
              <p className="text-white/30 text-[12px]">
                {analysis.fingerprint.motion_line}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            {[
              {
                label: "Complexity",
                val: getComplexityLabel(settings.complexity),
                num: formatPercent(settings.complexity),
              },
              {
                label: "Tone",
                val: getToneLabel(settings.tone),
                num: formatPercent(settings.tone),
              },
              {
                label: "Energy",
                val: getEnergyLabel(settings.energy),
                num: formatPercent(settings.energy),
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]"
              >
                <span className="text-white/30 text-[11px]">
                  {item.label}
                </span>
                <span className="text-white/60 text-[12px]">
                  {item.val}
                </span>
                <span className="text-white/20 text-[11px]">
                  ({item.num})
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.04] text-white/45 border border-white/[0.06]">
              Support amount: {controls.supportAmount}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.04] text-white/45 border border-white/[0.06]">
              Support register: {controls.supportRegister}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.04] text-white/45 border border-white/[0.06]">
              Instrument color: {controls.instrumentColor}
            </span>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-white/25 text-[11px] uppercase tracking-wider mb-2">
              Melody input summary
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300/70">
                Notes placed:{" "}
                {session.melodyInput.pianoRollNotes.length}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300/70">
                Steps: {session.melodyInput.melodySteps.length}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300/70">
                Register: {analysis.predictions.register}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300/70">
                Density: {analysis.predictions.density}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300/70">
                Motion: {analysis.predictions.motion}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleSave}
            disabled={saved}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-[#0a0a0f] hover:bg-white/90 transition cursor-pointer disabled:opacity-50 text-[14px]"
          >
            <Save className="w-4 h-4" />
            {saved ? "Saved ✓" : "Save version"}
          </button>

          <button
            onClick={() => navigate("/compare")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/[0.08] text-white/50 hover:text-white/80 hover:border-white/20 transition cursor-pointer text-[14px]"
          >
            <GitCompare className="w-4 h-4" />
            Compare versions
          </button>

          <button
            onClick={() => navigate("/refine")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/[0.08] text-white/50 hover:text-white/80 hover:border-white/20 transition cursor-pointer text-[14px]"
          >
            Refine again
          </button>
        </div>
      </div>
    </div>
  );
}