import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Check,
  Sparkles,
  Drum,
  MessageSquare,
  Activity,
  ArrowRight,
} from "lucide-react";
import {
  getCreationSession,
  saveCreationSession,
} from "../lib/creationSession";
import type { AnalysisCard } from "../lib/api";

interface StatBadgeProps {
  label: string;
  value: string;
  sub: string;
  colorClass: string;
}

function StatBadge({ label, value, sub, colorClass }: StatBadgeProps) {
  return (
    <div className={`rounded-xl border p-3 ${colorClass}`}>
      <p className="text-[10px] uppercase tracking-wider opacity-60 mb-1">{label}</p>
      <p className="text-[15px]">{value}</p>
      <p className="text-[11px] opacity-40 mt-0.5">{sub}</p>
    </div>
  );
}

function titleCase(value: string) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getCardTheme(familyKey?: string) {
  switch (familyKey) {
    case "dreamy_calm":
      return {
        color: "from-blue-500/10 to-cyan-500/10",
        accent: "border-blue-500/30",
        tagColor: "text-blue-300/70 bg-blue-500/10",
      };
    case "warm_grounded":
      return {
        color: "from-amber-500/10 to-orange-500/10",
        accent: "border-amber-500/30",
        tagColor: "text-amber-300/70 bg-amber-500/10",
      };
    case "energetic_playful":
      return {
        color: "from-emerald-500/10 to-cyan-500/10",
        accent: "border-emerald-500/30",
        tagColor: "text-emerald-300/70 bg-emerald-500/10",
      };
    case "gentle_reflective":
      return {
        color: "from-violet-500/10 to-fuchsia-500/10",
        accent: "border-violet-500/30",
        tagColor: "text-violet-300/70 bg-violet-500/10",
      };
    default:
      return {
        color: "from-purple-500/10 to-blue-500/10",
        accent: "border-purple-500/30",
        tagColor: "text-purple-300/70 bg-purple-500/10",
      };
  }
}

function getRegisterSub(register: string) {
  if (register === "high") return "Higher, lighter range";
  if (register === "mid") return "Balanced middle range";
  return "Lower, grounded range";
}

function getDensitySub(density: string) {
  if (density === "dense") return "More note activity";
  if (density === "medium") return "Balanced activity";
  return "More space between notes";
}

function getMotionSub(motion: string) {
  if (motion === "leapy") return "Larger interval jumps";
  if (motion === "mixed") return "Steps and jumps";
  return "Mostly smooth movement";
}

export function SuggestionCards() {
  const navigate = useNavigate();
  const session = useMemo(() => getCreationSession(), []);
  const analysis = session.analysis;

  const [selected, setSelected] = useState<number | null>(
    session.selection.selectedCardIndex
  );

  if (!analysis) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center px-6">
        <p className="text-white/50 text-[15px] mb-3">
          No analysis found yet.
        </p>
        <p className="text-white/25 text-[13px] mb-6 text-center max-w-md">
          Go back to the melody page, draw a melody, and click Analyze first.
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

  const cards = analysis.cards;

  const handleSelectAndContinue = () => {
    if (selected === null) return;

    const selectedCard: AnalysisCard | null = cards[selected] || null;

    saveCreationSession({
      ...session,
      selection: {
        selectedCardIndex: selected,
        selectedCard,
      },
    });

    navigate("/refine");
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <button
            onClick={() => navigate("/melody")}
            className="flex items-center gap-2 text-white/40 hover:text-white/70 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-[13px]">Back to melody</span>
          </button>
          <div className="flex items-center gap-2 text-white/30 text-[13px]">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            Step 2 of 4
          </div>
        </div>

        <div className="mb-8">
          <h1 className="text-white text-[28px] tracking-tight mb-2">
            AI Suggestions
          </h1>
          <p className="text-white/40 text-[15px]">
            These directions are now coming from your real backend analysis.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-5 mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-blue-500/20 flex items-center justify-center">
                <Activity className="w-3.5 h-3.5 text-blue-300" />
              </div>
              <span className="text-white/70 text-[13px]">Melody Profile</span>
            </div>
            <span className="text-white/25 text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-white/[0.06]">
              Backend analysis
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatBadge
              label="Register"
              value={titleCase(analysis.predictions.register)}
              sub={getRegisterSub(analysis.predictions.register)}
              colorClass="bg-blue-500/10 border-blue-500/20 text-blue-200"
            />
            <StatBadge
              label="Density"
              value={titleCase(analysis.predictions.density)}
              sub={getDensitySub(analysis.predictions.density)}
              colorClass="bg-purple-500/10 border-purple-500/20 text-purple-200"
            />
            <StatBadge
              label="Motion"
              value={titleCase(analysis.predictions.motion)}
              sub={getMotionSub(analysis.predictions.motion)}
              colorClass="bg-emerald-500/10 border-emerald-500/20 text-emerald-200"
            />
          </div>

          <div className="space-y-2 mb-3">
            <p className="text-white/45 text-[13px] leading-relaxed">
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

          <div className="flex items-center gap-1.5 text-white/25 text-[12px]">
            <span>We used this fingerprint to generate the directions below</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {cards.map((card, idx) => {
            const theme = getCardTheme(card.family_key);
            const isSelected = selected === idx;

            return (
              <motion.div
                key={`${card.family_key}-${idx}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.12, duration: 0.4 }}
                onClick={() => setSelected(idx)}
                className={`relative rounded-2xl border p-5 cursor-pointer transition-all ${
                  isSelected
                    ? `${theme.accent} bg-gradient-to-b ${theme.color} shadow-lg`
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
                }`}
              >
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute top-4 right-4 w-6 h-6 rounded-full bg-white flex items-center justify-center"
                  >
                    <Check className="w-3.5 h-3.5 text-[#0a0a0f]" />
                  </motion.div>
                )}

                <div className="mb-3">
                  <span
                    className={`inline-block text-[10px] px-2 py-0.5 rounded-full border border-white/[0.08] ${theme.tagColor}`}
                  >
                    {card.family_key.replaceAll("_", " ")}
                  </span>
                </div>

                <h3 className="text-white text-[17px] mb-1">{card.style}</h3>
                <p className="text-white/30 text-[12px] mb-4">
                  {card.variant_name}
                </p>

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Sparkles className="w-3 h-3 text-white/30" />
                      <span className="text-[10px] text-white/30 uppercase tracking-wider">
                        Preset
                      </span>
                    </div>
                    <p className="text-white/70 text-[13px]">{card.preset}</p>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Drum className="w-3 h-3 text-white/30" />
                      <span className="text-[10px] text-white/30 uppercase tracking-wider">
                        Rhythm advice
                      </span>
                    </div>
                    <p className="text-white/70 text-[13px]">
                      {card.rhythm_advice}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <MessageSquare className="w-3 h-3 text-white/30" />
                      <span className="text-[10px] text-white/30 uppercase tracking-wider">
                        Why this
                      </span>
                    </div>
                    <p
                      className="text-white/50 text-[12px]"
                      style={{ lineHeight: 1.55 }}
                    >
                      {card.explanation}
                    </p>
                  </div>

                  <div>
                    <span className="inline-block text-[11px] px-2 py-0.5 rounded-md bg-white/[0.04] text-white/45 border border-white/[0.06]">
                      Tone hint: {card.tone_hint}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="flex justify-end">
          <button
            disabled={selected === null}
            onClick={handleSelectAndContinue}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-white text-[#0a0a0f] hover:bg-white/90 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-[14px]"
          >
            Select &amp; refine
          </button>
        </div>
      </div>
    </div>
  );
}