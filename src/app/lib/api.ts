export const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL ||
  "http://localhost:8001";

export interface AnalyzeMelodyPayload {
  melody_steps: number[];
  complexity?: number;
  tone?: number;
  energy?: number;
}

export interface AnalysisPredictions {
  density: string;
  register: string;
  motion: string;
}

export interface AnalysisFingerprint {
  register_line: string;
  density_line: string;
  motion_line: string;
  summary: string;
}

export interface AnalysisCard {
  family_key: string;
  style: string;
  variant_name: string;
  preset: string;
  rhythm_advice: string;
  tone_hint: string;
  explanation: string;
}

export interface AnalysisResponse {
  input_melody_steps: number[];
  predictions: AnalysisPredictions;
  fingerprint: AnalysisFingerprint;
  cards: AnalysisCard[];
  refinement: {
    complexity: number;
    tone: number;
    energy: number;
  };
}

async function parseError(res: Response) {
  try {
    const data = await res.json();
    return data?.detail || data?.error || JSON.stringify(data);
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function analyzeMelody(
  payload: AnalyzeMelodyPayload,
): Promise<AnalysisResponse> {
  const res = await fetch(`${API_BASE_URL}/analyze_melody`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      melody_steps: payload.melody_steps,
      complexity: payload.complexity ?? 0.35,
      tone: payload.tone ?? 0.3,
      energy: payload.energy ?? 0.25,
    }),
  });

  if (!res.ok) {
    const message = await parseError(res);
    throw new Error(`Analyze request failed: ${message}`);
  }

  return res.json();
}

export async function checkHealth() {
  const res = await fetch(`${API_BASE_URL}/health`);
  if (!res.ok) {
    throw new Error(`Health check failed: HTTP ${res.status}`);
  }
  return res.json();
}