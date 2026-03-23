import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Trash2,
  Sparkles,
  Play,
  Square,
  Info,
  Undo2,
  Redo2,
} from "lucide-react";
import { analyzeMelody } from "../lib/api";
import {
  buildEmptyCreationSession,
  notesToMelodySteps,
  saveCreationSession,
} from "../lib/creationSession";

const PITCHES = [
  "C5",
  "B4",
  "A4",
  "G4",
  "F4",
  "E4",
  "D4",
  "C4",
] as const;

const TOTAL_BEATS = 16;
const LABEL_WIDTH = 56;
const HEADER_HEIGHT = 28;
const ROW_HEIGHT = 42;

const PITCH_FREQS: Record<string, number> = {
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  B4: 493.88,
  C5: 523.25,
};

const NOTE_COLORS: Record<string, string> = {
  C4: "bg-purple-400/70 border-purple-300/50",
  D4: "bg-blue-400/70 border-blue-300/50",
  E4: "bg-cyan-400/70 border-cyan-300/50",
  F4: "bg-emerald-400/70 border-emerald-300/50",
  G4: "bg-yellow-400/70 border-yellow-300/50",
  A4: "bg-orange-400/70 border-orange-300/50",
  B4: "bg-pink-400/70 border-pink-300/50",
  C5: "bg-violet-400/70 border-violet-300/50",
};

const PITCH_DOT_COLORS: Record<string, string> = {
  C4: "bg-purple-400",
  D4: "bg-blue-400",
  E4: "bg-cyan-400",
  F4: "bg-emerald-400",
  G4: "bg-yellow-400",
  A4: "bg-orange-400",
  B4: "bg-pink-400",
  C5: "bg-violet-400",
};

interface PianoNote {
  id: string;
  pitch: string;
  startBeat: number;
  duration: number;
}

interface HistoryState {
  notes: PianoNote[];
}

type InteractionState =
  | {
      type: "create";
      noteId: string;
      pitch: string;
      anchorBeat: number;
      baseNotes: PianoNote[];
    }
  | {
      type: "resize-right";
      noteId: string;
      pitch: string;
      fixedStartBeat: number;
      baseNotes: PianoNote[];
    }
  | {
      type: "resize-left";
      noteId: string;
      pitch: string;
      fixedEndBeat: number;
      baseNotes: PianoNote[];
    }
  | {
      type: "move";
      noteId: string;
      offsetBeat: number;
      duration: number;
      originalPitch: string;
      baseNotes: PianoNote[];
    };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function sortNotes(notes: PianoNote[]) {
  return [...notes].sort((a, b) => {
    if (a.startBeat !== b.startBeat) return a.startBeat - b.startBeat;
    if (a.duration !== b.duration) return a.duration - b.duration;
    return a.pitch.localeCompare(b.pitch);
  });
}

function areNotesEqual(a: PianoNote[], b: PianoNote[]) {
  return JSON.stringify(sortNotes(a)) === JSON.stringify(sortNotes(b));
}

function cloneNotes(notes: PianoNote[]) {
  return notes.map((n) => ({ ...n }));
}

/**
 * Melody-first overwrite rule:
 * - only one note can exist at a given time
 * - the edited/new note wins
 * - overlapped old notes are trimmed / split / removed
 */
function applyMonophonicNote(baseNotes: PianoNote[], draft: PianoNote) {
  const draftStart = draft.startBeat;
  const draftEnd = draft.startBeat + draft.duration;

  const result: PianoNote[] = [];

  for (const note of baseNotes) {
    if (note.id === draft.id) continue;

    const noteStart = note.startBeat;
    const noteEnd = note.startBeat + note.duration;

    const noOverlap = noteEnd <= draftStart || noteStart >= draftEnd;
    if (noOverlap) {
      result.push({ ...note });
      continue;
    }

    // left remainder
    if (noteStart < draftStart) {
      result.push({
        ...note,
        duration: draftStart - noteStart,
      });
    }

    // right remainder
    if (noteEnd > draftEnd) {
      result.push({
        ...note,
        id: `${note.id}-tail-${draftStart}-${draftEnd}`,
        startBeat: draftEnd,
        duration: noteEnd - draftEnd,
      });
    }
  }

  result.push({ ...draft });
  return sortNotes(result);
}

export function MelodyInput() {
  const navigate = useNavigate();

  const [notes, setNotes] = useState<PianoNote[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadBeat, setPlayheadBeat] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryState[]>([{ notes: [] }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const notesRef = useRef<PianoNote[]>([]);
  const interactionRef = useRef<InteractionState | null>(null);
  const interactionChangedRef = useRef(false);
  const isMouseDownRef = useRef(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const gridContentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const saveToHistory = (newNotes: PianoNote[]) => {
    const currentNotes = history[historyIndex]?.notes ?? [];
    if (areNotesEqual(currentNotes, newNotes)) return;

    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push({ notes: sortNotes(newNotes) });
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setNotes(history[newIndex].notes);
    setSelectedNoteId(null);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setNotes(history[newIndex].notes);
    setSelectedNoteId(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      if (cmdOrCtrl && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selectedNoteId) {
        e.preventDefault();
        const next = notesRef.current.filter((n) => n.id !== selectedNoteId);
        setNotes(next);
        saveToHistory(next);
        setSelectedNoteId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [history, historyIndex, selectedNoteId]);

  const getAudioCtx = () => {
    if (!audioCtxRef.current) {
      const AudioCtxClass =
        window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioCtxClass();
    }

    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }

    return audioCtxRef.current;
  };

  const playNoteSound = (pitch: string, dur = 0.35) => {
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.value = PITCH_FREQS[pitch] || 440;

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);

      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {}
  };

  const occupiedSet = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => {
      for (let b = n.startBeat; b < n.startBeat + n.duration; b++) {
        set.add(`${n.pitch}-${b}`);
      }
    });
    return set;
  }, [notes]);

  const hasNoteAt = (pitch: string, beat: number) =>
    occupiedSet.has(`${pitch}-${beat}`);

  const findNoteById = (noteId: string, source = notesRef.current) =>
    source.find((n) => n.id === noteId);

  const getBeatFromClientX = (clientX: number) => {
    const el = gridContentRef.current;
    if (!el) return 0;

    const rect = el.getBoundingClientRect();
    const usableWidth = rect.width - LABEL_WIDTH;
    const relativeX = clientX - rect.left - LABEL_WIDTH;

    const rawBeat = Math.floor((relativeX / usableWidth) * TOTAL_BEATS);
    return clamp(rawBeat, 0, TOTAL_BEATS - 1);
  };

  const getPitchFromClientY = (clientY: number) => {
    const el = gridContentRef.current;
    if (!el) return null;

    const rect = el.getBoundingClientRect();
    const relativeY = clientY - rect.top - HEADER_HEIGHT;

    if (relativeY < 0) return PITCHES[0];

    const rowIndex = clamp(
      Math.floor(relativeY / ROW_HEIGHT),
      0,
      PITCHES.length - 1
    );

    return PITCHES[rowIndex];
  };

  const startCreateNote = (pitch: string, beat: number) => {
    const baseNotes = cloneNotes(notesRef.current);
    const id = `${pitch}-${beat}-${Date.now()}`;

    const draft: PianoNote = {
      id,
      pitch,
      startBeat: beat,
      duration: 1,
    };

    const nextNotes = applyMonophonicNote(baseNotes, draft);
    setNotes(nextNotes);
    setSelectedNoteId(id);
    playNoteSound(pitch);

    interactionRef.current = {
      type: "create",
      noteId: id,
      pitch,
      anchorBeat: beat,
      baseNotes,
    };
    interactionChangedRef.current = true;
  };

  const startMoveNote = (
    e: React.MouseEvent<HTMLDivElement>,
    note: PianoNote
  ) => {
    e.stopPropagation();
    e.preventDefault();

    isMouseDownRef.current = true;

    const clickedBeat = getBeatFromClientX(e.clientX);
    const offsetBeat = clamp(
      clickedBeat - note.startBeat,
      0,
      Math.max(0, note.duration - 1)
    );

    interactionRef.current = {
      type: "move",
      noteId: note.id,
      offsetBeat,
      duration: note.duration,
      originalPitch: note.pitch,
      baseNotes: cloneNotes(notesRef.current),
    };
    interactionChangedRef.current = false;
    setSelectedNoteId(note.id);
  };

  const startResizeRight = (
    e: React.MouseEvent<HTMLDivElement>,
    note: PianoNote
  ) => {
    e.stopPropagation();
    e.preventDefault();

    isMouseDownRef.current = true;
    interactionRef.current = {
      type: "resize-right",
      noteId: note.id,
      pitch: note.pitch,
      fixedStartBeat: note.startBeat,
      baseNotes: cloneNotes(notesRef.current),
    };
    interactionChangedRef.current = false;
    setSelectedNoteId(note.id);
  };

  const startResizeLeft = (
    e: React.MouseEvent<HTMLDivElement>,
    note: PianoNote
  ) => {
    e.stopPropagation();
    e.preventDefault();

    isMouseDownRef.current = true;
    interactionRef.current = {
      type: "resize-left",
      noteId: note.id,
      pitch: note.pitch,
      fixedEndBeat: note.startBeat + note.duration,
      baseNotes: cloneNotes(notesRef.current),
    };
    interactionChangedRef.current = false;
    setSelectedNoteId(note.id);
  };

  const handleCellMouseDown = (pitch: string, beat: number) => {
    isMouseDownRef.current = true;
    setSelectedNoteId(null);
    startCreateNote(pitch, beat);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseDownRef.current || !interactionRef.current) return;

      const interaction = interactionRef.current;
      const beat = getBeatFromClientX(e.clientX);
      const pitchFromPointer = getPitchFromClientY(e.clientY);
      const baseNotes = interaction.baseNotes;

      if (interaction.type === "create") {
        const newStartBeat = Math.min(interaction.anchorBeat, beat);
        const newEndBeat = Math.max(interaction.anchorBeat, beat);
        const draft: PianoNote = {
          id: interaction.noteId,
          pitch: interaction.pitch,
          startBeat: newStartBeat,
          duration: newEndBeat - newStartBeat + 1,
        };

        const nextNotes = applyMonophonicNote(baseNotes, draft);
        interactionChangedRef.current = true;
        setNotes(nextNotes);
        return;
      }

      if (interaction.type === "resize-right") {
        const draft = findNoteById(interaction.noteId, notesRef.current);
        if (!draft) return;

        const newDuration = beat - interaction.fixedStartBeat + 1;
        const safeDuration = clamp(
          newDuration,
          1,
          TOTAL_BEATS - interaction.fixedStartBeat
        );

        const updated: PianoNote = {
          ...draft,
          pitch: interaction.pitch,
          startBeat: interaction.fixedStartBeat,
          duration: safeDuration,
        };

        const nextNotes = applyMonophonicNote(baseNotes, updated);
        interactionChangedRef.current = true;
        setNotes(nextNotes);
        return;
      }

      if (interaction.type === "resize-left") {
        const draft = findNoteById(interaction.noteId, notesRef.current);
        if (!draft) return;

        const newStartBeat = clamp(beat, 0, interaction.fixedEndBeat - 1);
        const updated: PianoNote = {
          ...draft,
          pitch: interaction.pitch,
          startBeat: newStartBeat,
          duration: interaction.fixedEndBeat - newStartBeat,
        };

        const nextNotes = applyMonophonicNote(baseNotes, updated);
        interactionChangedRef.current = true;
        setNotes(nextNotes);
        return;
      }

      if (interaction.type === "move") {
        const targetPitch = pitchFromPointer ?? interaction.originalPitch;
        const proposedStartBeat = beat - interaction.offsetBeat;
        const clampedStartBeat = clamp(
          proposedStartBeat,
          0,
          TOTAL_BEATS - interaction.duration
        );

        const updated: PianoNote = {
          id: interaction.noteId,
          pitch: targetPitch,
          startBeat: clampedStartBeat,
          duration: interaction.duration,
        };

        const nextNotes = applyMonophonicNote(baseNotes, updated);
        interactionChangedRef.current = true;
        setNotes(nextNotes);
      }
    };

    const handleMouseUp = () => {
      if (interactionRef.current && interactionChangedRef.current) {
        saveToHistory(notesRef.current);
      }

      isMouseDownRef.current = false;
      interactionRef.current = null;
      interactionChangedRef.current = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [history, historyIndex]);

  const clearAll = () => {
    const nextNotes: PianoNote[] = [];
    setNotes(nextNotes);
    saveToHistory(nextNotes);
    setSelectedNoteId(null);
  };

  const playMelody = () => {
    if (isPlaying || notes.length === 0) return;

    setIsPlaying(true);
    setPlayheadBeat(0);

    const ctx = getAudioCtx();
    const beatDur = 0.22;
    const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat);

    sorted.forEach((n) => {
      const start = ctx.currentTime + n.startBeat * beatDur;
      const dur = n.duration * beatDur * 0.85;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.value = PITCH_FREQS[n.pitch] || 440;

      gain.gain.setValueAtTime(0.18, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur);
    });

    const last = sorted[sorted.length - 1];
    const totalBeats = last.startBeat + last.duration;
    const totalMs = totalBeats * beatDur * 1000;

    let beat = 0;
    const interval = window.setInterval(() => {
      beat += 1;
      setPlayheadBeat(beat);

      if (beat >= totalBeats) {
        window.clearInterval(interval);
        window.setTimeout(() => {
          setIsPlaying(false);
          setPlayheadBeat(null);
        }, 200);
      }
    }, beatDur * 1000);

    window.setTimeout(() => {
      window.clearInterval(interval);
      setIsPlaying(false);
      setPlayheadBeat(null);
    }, totalMs + 400);
  };

  const handleAnalyze = async () => {
    if (notes.length < 2 || isAnalyzing) return;

    setAnalyzeError(null);
    setIsAnalyzing(true);

    try {
      const sortedNotes = [...notes].sort((a, b) => a.startBeat - b.startBeat);
      const melodySteps = notesToMelodySteps(sortedNotes, TOTAL_BEATS, 32);

      const baseSession = buildEmptyCreationSession();
      const seededSession = {
        ...baseSession,
        melodyInput: {
          pianoRollNotes: sortedNotes,
          totalBeats: TOTAL_BEATS,
          melodySteps,
        },
        analysis: null,
        selection: {
          selectedCardIndex: null,
          selectedCard: null,
        },
        refine: {
          complexity: 0.35,
          tone: 0.3,
          energy: 0.25,
        },
      };

      saveCreationSession(seededSession);

      const analysis = await analyzeMelody({
        melody_steps: melodySteps,
        complexity: 0.35,
        tone: 0.3,
        energy: 0.25,
      });

      saveCreationSession({
        ...seededSession,
        analysis,
        refine: analysis.refinement,
      });

      navigate("/suggestions");
    } catch (error) {
      console.error(error);
      setAnalyzeError(
        error instanceof Error ? error.message : "Failed to analyze melody."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const usedPitches = [...new Set(notes.map((n) => n.pitch))];
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white px-6 py-8 select-none">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-white/40 hover:text-white/70 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-[13px]">Back</span>
          </button>

          <div className="flex items-center gap-2 text-white/30 text-[13px]">
            <div className="w-2 h-2 rounded-full bg-purple-400" />
            Step 1 of 4
          </div>
        </div>

        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-white text-[28px] tracking-tight">
              Write your melody
            </h1>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300/70 border border-purple-500/15">
              Melody-only
            </span>
          </div>
          <p className="text-white/40 text-[15px]">
            This line is your melody. AI will analyze this exact melody and build around it later.
          </p>
        </div>

        <div className="flex items-center gap-2 mb-3 px-4 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white/25 text-[12px]">
          <Info className="w-3 h-3 flex-shrink-0 text-white/30" />
          <span>
            Step 1 is only for your main melody. If a new note overlaps an older one,
            the new melody replaces that section.
          </span>
        </div>

        <div className="flex items-center gap-2 mb-5 px-4 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white/25 text-[12px]">
          <Info className="w-3 h-3 flex-shrink-0 text-white/30" />
          <span>
            Preview here = the exact melody that will be analyzed.
          </span>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.015] mb-5 overflow-hidden relative">
          {notes.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
            >
              <div className="text-center px-6">
                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{
                    repeat: Infinity,
                    duration: 2,
                    ease: "easeInOut",
                  }}
                  className="mb-3"
                >
                  <div className="w-12 h-12 mx-auto rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                    <span className="text-2xl">👆</span>
                  </div>
                </motion.div>
                <p className="text-white/40 text-[14px] mb-1">
                  Click any square to place your first melody note
                </p>
                <p className="text-white/25 text-[12px]">
                  Hold and drag left or right to shape the melody
                </p>
              </div>
            </motion.div>
          )}

          <div className="overflow-x-auto">
            <div ref={gridContentRef} style={{ minWidth: "580px" }}>
              <div className="flex border-b border-white/[0.05]" style={{ height: "28px" }}>
                <div className="flex-shrink-0" style={{ width: "56px" }} />

                <div className="flex-1 relative flex">
                  {playheadBeat !== null && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-purple-400/60 z-10 transition-all duration-[220ms] pointer-events-none"
                      style={{
                        left: `${(playheadBeat / TOTAL_BEATS) * 100}%`,
                      }}
                    />
                  )}

                  {Array.from({ length: TOTAL_BEATS }).map((_, i) => (
                    <div
                      key={i}
                      className={`flex-1 flex items-center justify-center text-[10px] ${
                        i % 4 === 0
                          ? "text-white/50 border-l border-white/[0.08]"
                          : "text-white/0"
                      } ${
                        playheadBeat !== null && i === Math.floor(playheadBeat)
                          ? "bg-purple-400/5"
                          : ""
                      }`}
                    >
                      {i % 4 === 0 ? i + 1 : ""}
                    </div>
                  ))}
                </div>
              </div>

              {PITCHES.map((pitch, pitchIdx) => {
                const isOctaveNote = pitch === "C4" || pitch === "C5";
                const rowNotes = [...notes]
                  .filter((n) => n.pitch === pitch)
                  .sort((a, b) => a.startBeat - b.startBeat);

                return (
                  <div
                    key={pitch}
                    className={`flex items-stretch ${
                      pitchIdx > 0 ? "border-t border-white/[0.04]" : ""
                    } ${isOctaveNote ? "bg-white/[0.012]" : ""}`}
                    style={{ height: "42px" }}
                  >
                    <div
                      className={`flex-shrink-0 flex items-center justify-end gap-1.5 pr-3 border-r border-white/[0.06] ${
                        isOctaveNote ? "text-white/55" : "text-white/28"
                      }`}
                      style={{ width: "56px" }}
                    >
                      {usedPitches.includes(pitch) && (
                        <div
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PITCH_DOT_COLORS[pitch]}`}
                          style={{ opacity: 0.6 }}
                        />
                      )}
                      <span className="text-[12px] font-mono">{pitch}</span>
                    </div>

                    <div className="flex-1 relative">
                      <div className="absolute inset-0 flex">
                        {Array.from({ length: TOTAL_BEATS }).map((_, beat) => {
                          const occupied = hasNoteAt(pitch, beat);
                          const isPlayheadBeat =
                            playheadBeat !== null &&
                            beat === Math.floor(playheadBeat);

                          return (
                            <div
                              key={beat}
                              className={`flex-1 h-full transition-colors ${
                                beat % 4 === 0
                                  ? "border-l border-white/[0.06]"
                                  : ""
                              } ${
                                isPlayheadBeat ? "bg-purple-400/[0.07]" : ""
                              } ${
                                occupied
                                  ? "cursor-pointer"
                                  : "cursor-crosshair hover:bg-white/[0.04]"
                              }`}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleCellMouseDown(pitch, beat);
                              }}
                            />
                          );
                        })}
                      </div>

                      {rowNotes.map((note) => {
                        const isSelected = note.id === selectedNoteId;

                        return (
                          <motion.div
                            key={note.id}
                            initial={{ scaleY: 0.6, opacity: 0 }}
                            animate={{ scaleY: 1, opacity: 1 }}
                            transition={{ duration: 0.12 }}
                            className={`absolute top-[5px] bottom-[5px] rounded border flex items-center overflow-hidden ${NOTE_COLORS[note.pitch]} ${
                              isSelected
                                ? "ring-2 ring-white/40 ring-offset-1 ring-offset-[#0a0a0f]"
                                : ""
                            }`}
                            style={{
                              left: `calc(${(note.startBeat / TOTAL_BEATS) * 100}% + 1px)`,
                              width: `calc(${(note.duration / TOTAL_BEATS) * 100}% - 3px)`,
                              pointerEvents: "none",
                            }}
                          >
                            <div
                              className="absolute left-0 top-0 bottom-0 w-3.5 cursor-ew-resize hover:bg-white/12 flex items-center justify-center z-20"
                              style={{ pointerEvents: "auto" }}
                              onMouseDown={(e) => startResizeLeft(e, note)}
                            >
                              <div className="flex gap-[2px]">
                                <div className="w-[2px] h-3 rounded-full bg-black/15" />
                                <div className="w-[2px] h-3 rounded-full bg-black/10" />
                              </div>
                            </div>

                            <div
                              className="absolute left-3 right-3 top-0 bottom-0 cursor-move flex items-center px-1.5"
                              style={{ pointerEvents: "auto" }}
                              onMouseDown={(e) => startMoveNote(e, note)}
                            >
                              {note.duration >= 3 && (
                                <span className="text-[9px] text-black/50 truncate pointer-events-none">
                                  {note.pitch}
                                </span>
                              )}
                            </div>

                            <div
                              className="absolute right-0 top-0 bottom-0 w-3.5 cursor-ew-resize hover:bg-white/12 flex items-center justify-center z-20"
                              style={{ pointerEvents: "auto" }}
                              onMouseDown={(e) => startResizeRight(e, note)}
                            >
                              <div className="flex gap-[2px]">
                                <div className="w-[2px] h-3 rounded-full bg-black/15" />
                                <div className="w-[2px] h-3 rounded-full bg-black/10" />
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <div className="flex border-t border-white/[0.04]" style={{ height: "24px" }}>
                <div
                  className="flex-shrink-0 text-[10px] text-white/20 flex items-center justify-end pr-3 border-r border-white/[0.06]"
                  style={{ width: "56px" }}
                >
                  Pitch
                </div>

                <div className="flex-1 flex items-center">
                  <div className="flex-1 flex">
                    {[1, 5, 9, 13].map((bar) => (
                      <div
                        key={bar}
                        className="text-[10px] text-white/15 flex items-center"
                        style={{
                          width: `${(4 / TOTAL_BEATS) * 100}%`,
                          paddingLeft: "4px",
                        }}
                      >
                        Bar {Math.ceil(bar / 4)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-6 px-1">
          <div className="flex items-center gap-1.5 text-[11px] text-white/25">
            <div className="w-4 h-3 rounded-sm bg-white/10 border border-white/15" />
            <span>Empty — click to write melody</span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-white/25">
            <div className="w-6 h-3 rounded-sm bg-purple-400/60 border border-purple-300/40" />
            <span>One melody line — new notes overwrite overlapping sections</span>
          </div>

          {notes.length > 0 && (
            <div className="ml-auto flex items-center gap-1.5 text-[11px] text-white/35">
              {usedPitches.slice(0, 6).map((p) => (
                <span
                  key={p}
                  className="px-1.5 py-0.5 rounded bg-white/[0.05] text-white/40"
                >
                  {p}
                </span>
              ))}
              {usedPitches.length > 6 && (
                <span className="text-white/25">+{usedPitches.length - 6}</span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            <div className="flex gap-2">
              <button
                onClick={undo}
                disabled={!canUndo}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-white/[0.08] text-white/50 hover:text-white/80 hover:border-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-[14px]"
                title="Undo (Cmd/Ctrl+Z)"
              >
                <Undo2 className="w-4 h-4" />
              </button>

              <button
                onClick={redo}
                disabled={!canRedo}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-white/[0.08] text-white/50 hover:text-white/80 hover:border-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-[14px]"
                title="Redo (Cmd/Ctrl+Shift+Z)"
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={playMelody}
              disabled={notes.length === 0 || isPlaying}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/[0.08] text-white/50 hover:text-white/80 hover:border-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-[14px]"
            >
              {isPlaying ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isPlaying ? "Playing…" : "Preview analyzed melody"}
            </button>

            <button
              onClick={clearAll}
              disabled={notes.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/[0.08] text-white/50 hover:text-white/80 hover:border-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-[14px]"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={notes.length < 2 || isAnalyzing}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-white text-[#0a0a0f] hover:bg-white/90 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-[14px]"
          >
            <Sparkles className="w-4 h-4" />
            {isAnalyzing ? "Analyzing..." : "Analyze melody"}
          </button>
        </div>

        <p className="text-white/20 text-[12px] mt-4 text-center">
          {notes.length} {notes.length === 1 ? "note" : "notes"} in your melody ·{" "}
          {notes.length < 2
            ? "add at least 2 notes to analyze"
            : "this exact melody is ready to analyze"}
          {selectedNoteId && " · Press Delete to remove selected note"}
        </p>

        {analyzeError && (
          <p className="text-red-300/80 text-[12px] mt-3 text-center">
            {analyzeError}
          </p>
        )}
      </div>
    </div>
  );
}