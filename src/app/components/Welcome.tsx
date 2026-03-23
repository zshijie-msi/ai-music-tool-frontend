import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { Music, Sparkles, ArrowRight } from "lucide-react";

export function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-purple-500/5 blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-blue-500/5 blur-[100px]" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 text-center max-w-xl"
      >
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center">
            <Music className="w-5 h-5 text-purple-300" />
          </div>
          <span className="text-white/60 tracking-widest uppercase text-[13px]">Muse</span>
        </div>

        <h1 className="text-white text-[42px] tracking-tight mb-4" style={{ lineHeight: 1.15 }}>
          Create music,{" "}
          <span className="bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">
            step by step
          </span>
        </h1>

        <p className="text-white/50 text-[17px] mb-10 max-w-md mx-auto" style={{ lineHeight: 1.6 }}>
          Enter a short melody, hear it instantly, and get AI suggestions you can compare and refine. No music training needed.
        </p>

        <button
          onClick={() => navigate("/melody")}
          className="group inline-flex items-center gap-3 px-7 py-3.5 rounded-full bg-white text-[#0a0a0f] hover:bg-white/90 transition-all cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          <span>Start creating</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>

        <div className="mt-16 flex items-center justify-center gap-8 text-white/30 text-[13px]">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-400/50" />
            Input melody
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400/50" />
            Compare AI directions
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/50" />
            Refine &amp; save
          </div>
        </div>
      </motion.div>
    </div>
  );
}
