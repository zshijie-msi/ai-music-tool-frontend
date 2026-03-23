import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  HelpCircle,
  Layers,
  Sun,
  Zap,
  Check,
  Sparkles,
  Drum,
  MessageSquare,
} from "lucide-react";
import { getCreationSession, saveCreationSession } from "../lib/creationSession";
import type { AnalysisCard } from "../lib/api";

function getStateLabel(dimension: "complexity" | "tone" | "energy", value: number): string {
  if (dimension === "complexity") {
    if (value < 0.18) return "Very Simple";
    if (value < 0.38) return "Simple";
    if (value < 0.62) return "Balanced";
    if (value < 0.82) return "Richer";
    return "Very Rich";
  }

  if (dimension === "tone") {
    if (value < 0.18) return "Very Soft";
    if (value < 0.38) return "Soft";
    if (value < 0.62) return "Balanced";
    if (value < 0.82) return "Brighter";
    return "Very Bright";
  }

  if (value < 0.18) return "Very Stable";
  if (value < 0.38) return "Stable";
  if (value < 0.62) return "Moderate";
  if (value < 0.82) return "Active";
  return "Very Active";
}

function getNumericOffset(value: number): string {
  const raw = value - 0.5;
  const rounded = Math.round(raw * 10) / 10;
  return rounded >= 0 ? `+${rounded.toFixed(1)}` : rounded.toFixed(1);
}

function getCardTheme(familyKey?: string) {
  switch (familyKey) {
    case "dreamy_calm":
      return {
        accent: "border-blue-500/25 bg-blue-500/[0.05]",
        tag: "text-blue-300/70 bg-blue-500/10",
      };
    case "warm_grounded":
      return {
        accent: "border-amber-500/25 bg-amber-500/[0.05]",
        tag: "text-amber-300/70 bg-amber-500/10",
      };
    case "energetic_playful":
      return {
        accent: "border-emerald-500/25 bg-emerald-500/[0.05]",
        tag: "text-emerald-300/70 bg-emerald-500/10",
      };
    case "gentle_reflective":
      return {
        accent: "border-violet-500/25 bg-violet-500/[0.05]",
        tag: "text-violet-300/70 bg-violet-500/10",
      };
    default:
      return {
        accent: "border-purple-500/25 bg-purple-500/[0.05]",
        tag: "text-purple-300/70 bg-purple-500/10",
      };
  }
}

interface SliderControlProps {
  dimension: "complexity" | "tone" | "energy";
  label: string;
  icon: any;
  leftLabel: string;
  rightLabel: string;
  helperText: string;
  microPreview: { low: string; balanced: string; high: string };
  value: number;
  onChange: (v: number) => void;
}

function SliderControl({
  dimension,
  label,
  icon,
  leftLabel,
  rightLabel,
  helperText,
  microPreview,
  value,
  onChange,
}: SliderControlProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const stateLabel = getStateLabel(dimension, value);
  const numericOffset = getNumericOffset(value);
  const isCenter = Math.abs(value - 0.5) < 0.06;

  const previewText =
    value < 0.38 ? microPreview.low : value > 0.62 ? microPreview.high : microPreview.balanced;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-white/[0.05] flex items-center justify-center text-white/40">
            {icon}
          </div>
          <span className="text-white/70 text-[14px]">{label}</span>

          <div className="relative">
            <button
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className="text-white/20 hover:text-white/50 transition cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>

            {showTooltip && (
              <div className="absolute left-0 bottom-7 z-20 w-56 rounded-xl bg-[#16162a] border border-white/[0.12] p-3.5 shadow-2xl">
                <p className="text-white/60 text-[12px] leading-relaxed">
                  {helperText}
                </p>
                <div className="mt-2.5 space-y-1">
                  {[
                    { label: leftLabel, desc: microPreview.low },
                    { label: "Balanced", desc: microPreview.balanced },
                    { label: rightLabel, desc: microPreview.high },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start gap-2">
                      <span className="text-white/30 text-[10px] w-16 flex-shrink-0 pt-0.5">
                        {item.label}
                      </span>
                      <span className="text-white/40 text-[11px] leading-relaxed">
                        {item.desc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-[12px] px-2 py-0.5 rounded-md transition-colors ${
              isCenter
                ? "text-white/35 bg-white/[0.04]"
                : "text-purple-300 bg-purple-500/10 border border-purple-500/20"
            }`}
          >
            {stateLabel}
          </span>
          <span
            className={`text-[12px] tabular-nums w-8 text-right transition-colors ${
              isCenter ? "text-white/20" : value > 0.5 ? "text-purple-400" : "text-blue-400"
            }`}
          >
            {numericOffset}
          </span>
        </div>
      </div>

      <p className="text-white/22 text-[11px] mb-4 ml-8">{previewText}</p>

      <div className="flex items-center gap-4">
        <span className="text-[12px] text-white/30 w-20 text-right flex-shrink-0">
          {leftLabel}
        </span>

        <div className="flex-1 relative">
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(value * 100)}
            onChange={(e) => onChange(Number(e.target.value) / 100)}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, rgba(168,85,247,0.65) 0%, rgba(168,85,247,0.65) ${Math.round(
                value * 100
              )}%, rgba(255,255,255,0.07) ${Math.round(
                value * 100
              )}%, rgba(255,255,255,0.07) 100%)`,
            }}
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-3.5 bg-white/15 rounded-full pointer-events-none" />
        </div>

        <span className="text-[12px] text-white/30 w-20 flex-shrink-0">
          {rightLabel}
        </span>
      </div>

      <div className="flex items-end gap-0.5 mt-3 ml-24 mr-24 h-3">
        {Array.from({ length: 20 }).map((_, i) => {
          const threshold = i / 19;
          const active = value >= threshold;
          return (
            <div
              key={i}
              className={`flex-1 rounded-full transition-all duration-75 ${
                active ? "bg-purple-400/50" : "bg-white/[0.06]"
              }`}
              style={{ height: `${40 + Math.sin((i / 19) * Math.PI) * 60}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}

function MiniCard({
  card,
  selected,
  onClick,
}: {
  card: AnalysisCard;
  selected: boolean;
  onClick: () => void;
}) {
  const theme = getCardTheme(card.family_key);

  return (
    <button
      onClick={onClick}
      className={`relative text-left rounded-xl border p-4 transition-all cursor-pointer ${
        selected
          ? `${theme.accent} shadow-lg`
          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
      }`}
    >
      {selected && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-white flex items-center justify-center">
          <Check className="w-3 h-3 text-[#0a0a0f]" />
        </div>
      )}

      <div className="mb-2">
        <span
          className={`inline-block text-[10px] px-2 py-0.5 rounded-full border border-white/[0.08] ${theme.tag}`}
        >
          {card.family_key?.replaceAll("_", " ")}
        </span>
      </div>

      <p className="text-white text-[15px] mb-1 pr-6">{card.style}</p>
      <p className="text-white/30 text-[11px] mb-3">{card.variant_name}</p>

      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <Sparkles className="w-3 h-3 text-white/25 mt-[2px] flex-shrink-0" />
          <p className="text-white/55 text-[11px] leading-relaxed">{card.preset}</p>
        </div>

        <div className="flex items-start gap-2">
          <Drum className="w-3 h-3 text-white/25 mt-[2px] flex-shrink-0" />
          <p className="text-white/45 text-[11px] leading-relaxed">{card.rhythm_advice}</p>
        </div>

        <div className="flex items-start gap-2">
          <MessageSquare className="w-3 h-3 text-white/25 mt-[2px] flex-shrink-0" />
          <p className="text-white/35 text-[11px] leading-relaxed">{card.tone_hint}</p>
        </div>
      </div>
    </button>
  );
}

export function Refinement() {
  const navigate = useNavigate();
  const session = useMemo(() => getCreationSession(), []);
  const analysis = session.analysis;
  const cards = analysis?.cards ?? [];

  const initialIndex =
    session.selection.selectedCardIndex !== null &&
    session.selection.selectedCardIndex >= 0
      ? session.selection.selectedCardIndex
      : 0;

  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [complexity, setComplexity] = useState(session.refine.complexity ?? 0.35);
  const [tone, setTone] = useState(session.refine.tone ?? 0.3);
  const [energy, setEnergy] = useState(session.refine.energy ?? 0.25);

  if (!analysis || cards.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center px-6">
        <p className="text-white/50 text-[15px] mb-3">
          No direction data found.
        </p>
        <p className="text-white/25 text-[13px] mb-6 text-center max-w-md">
          Go back to the suggestions page and choose a direction first.
        </p>
        <button
          onClick={() => navigate("/suggestions")}
          className="px-5 py-2.5 rounded-lg bg-white text-[#0a0a0f] hover:bg-white/90 transition cursor-pointer text-[14px]"
        >
          Back to suggestions
        </button>
      </div>
    );
  }

  const selectedCard = cards[selectedIndex] ?? cards[0];

  const handleSwitchCard = (idx: number) => {
    setSelectedIndex(idx);

    saveCreationSession({
      ...session,
      selection: {
        selectedCardIndex: idx,
        selectedCard: cards[idx],
      },
      refine: {
        complexity,
        tone,
        energy,
      },
    });
  };

  const handleContinue = () => {
    saveCreationSession({
      ...session,
      selection: {
        selectedCardIndex: selectedIndex,
        selectedCard,
      },
      refine: {
        complexity,
        tone,
        energy,
      },
    });

    navigate("/result");
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white px-6 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <button
            onClick={() => navigate("/suggestions")}
            className="flex items-center gap-2 text-white/40 hover:text-white/70 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-[13px]">Back</span>
          </button>

          <div className="flex items-center gap-2 text-white/30 text-[13px]">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            Step 3 of 4
          </div>
        </div>

        <div className="mb-8">
          <h1 className="text-white text-[28px] tracking-tight mb-2">
            Refine this direction
          </h1>
          <p className="text-white/40 text-[15px] leading-relaxed">
            You can still switch directions here before generating the draft.
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white/70 text-[14px]">Directions</p>
              <p className="text-white/25 text-[12px] mt-1">
                Compare the three AI directions again without going back.
              </p>
            </div>

            <button
              onClick={() => navigate("/suggestions")}
              className="text-[12px] px-3 py-1.5 rounded-lg border border-white/[0.08] text-white/45 hover:text-white/75 hover:border-white/20 transition cursor-pointer"
            >
              Full suggestions view
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {cards.map((card, idx) => (
              <MiniCard
                key={`${card.family_key}-${idx}`}
                card={card}
                selected={idx === selectedIndex}
                onClick={() => handleSwitchCard(idx)}
              />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-white text-[17px]">{selectedCard.style}</p>
              <p className="text-white/30 text-[12px]">{selectedCard.variant_name}</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-white/35 border border-white/[0.08] uppercase tracking-wider">
              current direction
            </span>
          </div>

          <div className="space-y-2 mt-4">
            <div>
              <p className="text-white/20 text-[10px] uppercase tracking-wider mb-1">Preset</p>
              <p className="text-white/65 text-[13px]">{selectedCard.preset}</p>
            </div>
            <div>
              <p className="text-white/20 text-[10px] uppercase tracking-wider mb-1">Rhythm advice</p>
              <p className="text-white/65 text-[13px]">{selectedCard.rhythm_advice}</p>
            </div>
            <div>
              <p className="text-white/20 text-[10px] uppercase tracking-wider mb-1">Tone hint</p>
              <p className="text-white/65 text-[13px]">{selectedCard.tone_hint}</p>
            </div>
            <div>
              <p className="text-white/20 text-[10px] uppercase tracking-wider mb-1">Why this</p>
              <p className="text-white/50 text-[13px] leading-relaxed">{selectedCard.explanation}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 mb-8">
          <SliderControl
            dimension="complexity"
            label="Complexity"
            icon={<Layers className="w-3.5 h-3.5" />}
            leftLabel="Simpler"
            rightLabel="Richer"
            helperText="Controls how layered or busy the arrangement should feel."
            microPreview={{
              low: "Fewer elements, more space, easier to follow.",
              balanced: "A balanced amount of support around your melody.",
              high: "More layers and more movement around the melody.",
            }}
            value={complexity}
            onChange={setComplexity}
          />

          <SliderControl
            dimension="tone"
            label="Tone"
            icon={<Sun className="w-3.5 h-3.5" />}
            leftLabel="Softer"
            rightLabel="Brighter"
            helperText="Shifts the overall tone from softer and darker to brighter and more sparkling."
            microPreview={{
              low: "More muted, soft, gentle colors.",
              balanced: "Neither too soft nor too bright.",
              high: "More sparkle, lift, and brightness.",
            }}
            value={tone}
            onChange={setTone}
          />

          <SliderControl
            dimension="energy"
            label="Energy"
            icon={<Zap className="w-3.5 h-3.5" />}
            leftLabel="Steadier"
            rightLabel="More active"
            helperText="Controls how much rhythmic motion and forward energy the draft should have."
            microPreview={{
              low: "More stable, calm, and restrained motion.",
              balanced: "Moderate motion with a steady pulse.",
              high: "More rhythmic activity and forward push.",
            }}
            value={energy}
            onChange={setEnergy}
          />
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 mb-8">
          <p className="text-white/25 text-[11px] uppercase tracking-wider mb-2">
            Fingerprint from analysis
          </p>
          <p className="text-white/50 text-[13px] leading-relaxed mb-2">
            {analysis.fingerprint.summary}
          </p>
          <p className="text-white/30 text-[12px]">{analysis.fingerprint.register_line}</p>
          <p className="text-white/30 text-[12px]">{analysis.fingerprint.density_line}</p>
          <p className="text-white/30 text-[12px]">{analysis.fingerprint.motion_line}</p>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleContinue}
            className="px-6 py-2.5 rounded-lg bg-white text-[#0a0a0f] hover:bg-white/90 transition cursor-pointer text-[14px]"
          >
            Continue to draft
          </button>
        </div>
      </div>
    </div>
  );
}