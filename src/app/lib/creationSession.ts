import type { AnalysisCard, AnalysisResponse } from "./api";

export const CREATION_SESSION_KEY = "ai_music_creation_session_v1";
export const SAVED_VERSIONS_KEY = "muse_versions";

export interface PianoNote {
  id: string;
  pitch: string;
  startBeat: number;
  duration: number;
}

export interface CreationSession {
  melodyInput: {
    pianoRollNotes: PianoNote[];
    totalBeats: number;
    melodySteps: number[];
  };
  analysis: AnalysisResponse | null;
  selection: {
    selectedCardIndex: number | null;
    selectedCard: AnalysisCard | null;
  };
  refine: {
    complexity: number;
    tone: number;
    energy: number;
  };
}

export const PITCH_TO_MIDI: Record<string, number> = {
  C4: 60,
  D4: 62,
  E4: 64,
  F4: 65,
  G4: 67,
  A4: 69,
  B4: 71,
  C5: 72,
};

export function buildEmptyCreationSession(): CreationSession {
  return {
    melodyInput: {
      pianoRollNotes: [],
      totalBeats: 16,
      melodySteps: Array(32).fill(0),
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
}

export function getCreationSession(): CreationSession {
  try {
    const raw = localStorage.getItem(CREATION_SESSION_KEY);
    if (!raw) return buildEmptyCreationSession();

    const parsed = JSON.parse(raw);
    return {
      ...buildEmptyCreationSession(),
      ...parsed,
      melodyInput: {
        ...buildEmptyCreationSession().melodyInput,
        ...(parsed?.melodyInput || {}),
      },
      selection: {
        ...buildEmptyCreationSession().selection,
        ...(parsed?.selection || {}),
      },
      refine: {
        ...buildEmptyCreationSession().refine,
        ...(parsed?.refine || {}),
      },
    };
  } catch {
    return buildEmptyCreationSession();
  }
}

export function saveCreationSession(session: CreationSession) {
  localStorage.setItem(CREATION_SESSION_KEY, JSON.stringify(session));
}

export function clearCreationSession() {
  localStorage.removeItem(CREATION_SESSION_KEY);
}

export function updateCreationSession(
  partial: Partial<CreationSession>
): CreationSession {
  const current = getCreationSession();
  const next: CreationSession = {
    ...current,
    ...partial,
    melodyInput: {
      ...current.melodyInput,
      ...(partial.melodyInput || {}),
    },
    selection: {
      ...current.selection,
      ...(partial.selection || {}),
    },
    refine: {
      ...current.refine,
      ...(partial.refine || {}),
    },
  };

  saveCreationSession(next);
  return next;
}

export function notesToMelodySteps(
  notes: PianoNote[],
  totalBeats = 16,
  totalSteps = 32
): number[] {
  const steps = Array(totalSteps).fill(0);
  const stepsPerBeat = totalSteps / totalBeats;

  const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat);

  for (const note of sorted) {
    const midi = PITCH_TO_MIDI[note.pitch];
    if (!midi) continue;

    const startStep = Math.max(0, Math.round(note.startBeat * stepsPerBeat));
    const durationSteps = Math.max(1, Math.round(note.duration * stepsPerBeat));
    const endStep = Math.min(totalSteps, startStep + durationSteps);

    for (let i = startStep; i < endStep; i++) {
      steps[i] = midi;
    }
  }

  return steps;
}