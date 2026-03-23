export interface PreviewCardLike {
  family_key?: string;
  style?: string;
}

export interface PreviewSettings {
  complexity: number;
  tone: number;
  energy: number;
}

export interface CoCreationControls {
  supportAmount: "less" | "balanced" | "more";
  supportRegister: "lower" | "balanced" | "higher";
  instrumentColor: "softer" | "balanced" | "brighter";
}

export interface DraftPreviewInput {
  melodySteps: number[];
  card?: PreviewCardLike | null;
  settings: PreviewSettings;
  controls?: CoCreationControls;
}

let activeCtx: AudioContext | null = null;
let activeMaster: GainNode | null = null;
let activeStopTimeout: number | null = null;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function midiToFreq(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function isNonZeroMidi(value: number) {
  return Number.isFinite(value) && value > 0;
}

function getAudioContext() {
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctx) {
    throw new Error("Web Audio is not supported in this browser.");
  }
  return new Ctx();
}

function cleanupContext() {
  if (activeStopTimeout !== null) {
    window.clearTimeout(activeStopTimeout);
    activeStopTimeout = null;
  }

  if (activeMaster && activeCtx) {
    try {
      activeMaster.gain.cancelScheduledValues(activeCtx.currentTime);
      activeMaster.gain.setValueAtTime(activeMaster.gain.value, activeCtx.currentTime);
      activeMaster.gain.linearRampToValueAtTime(0.0001, activeCtx.currentTime + 0.05);
    } catch {}
  }

  const ctxToClose = activeCtx;
  activeCtx = null;
  activeMaster = null;

  if (ctxToClose) {
    try {
      ctxToClose.close();
    } catch {}
  }
}

export function stopDraftPreview() {
  cleanupContext();
}

function buildMelodyEvents(steps: number[]) {
  const events: Array<{ midi: number; startStep: number; lengthSteps: number }> = [];

  let i = 0;
  while (i < steps.length) {
    const midi = steps[i];
    if (!isNonZeroMidi(midi)) {
      i += 1;
      continue;
    }

    let j = i + 1;
    while (j < steps.length && steps[j] === midi) {
      j += 1;
    }

    events.push({
      midi,
      startStep: i,
      lengthSteps: j - i,
    });

    i = j;
  }

  return events;
}

const WHITE_KEYS = [
  36, 38, 40, 41, 43, 45, 47,
  48, 50, 52, 53, 55, 57, 59,
  60, 62, 64, 65, 67, 69, 71,
  72, 74, 76, 77, 79, 81, 83,
  84, 86, 88, 89, 91, 93, 95, 96,
];

function nearestScaleMidi(target: number) {
  return WHITE_KEYS.reduce((closest, current) => {
    return Math.abs(current - target) < Math.abs(closest - target) ? current : closest;
  }, WHITE_KEYS[0]);
}

function stepScaleMidi(base: number, offset: number) {
  const nearest = nearestScaleMidi(base);
  const index = WHITE_KEYS.indexOf(nearest);
  const nextIndex = clamp(index + offset, 0, WHITE_KEYS.length - 1);
  return WHITE_KEYS[nextIndex];
}

function shiftMidiInScale(midi: number, registerShift: number) {
  if (registerShift === 0) return midi;
  const offsetSteps = registerShift > 0 ? 7 : -7;
  return stepScaleMidi(midi, offsetSteps);
}

function createMixBuses(ctx: AudioContext) {
  const master = ctx.createGain();
  master.gain.value = 0.92;

  const dryBus = ctx.createGain();
  dryBus.gain.value = 1;

  const fxBus = ctx.createGain();
  fxBus.gain.value = 0.65;

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -22;
  compressor.knee.value = 18;
  compressor.ratio.value = 3.2;
  compressor.attack.value = 0.008;
  compressor.release.value = 0.16;

  const masterTone = ctx.createBiquadFilter();
  masterTone.type = "lowpass";
  masterTone.frequency.value = 5600;
  masterTone.Q.value = 0.45;

  const delayA = ctx.createDelay(0.8);
  delayA.delayTime.value = 0.16;

  const delayB = ctx.createDelay(1.2);
  delayB.delayTime.value = 0.31;

  const feedbackA = ctx.createGain();
  feedbackA.gain.value = 0.13;

  const feedbackB = ctx.createGain();
  feedbackB.gain.value = 0.18;

  const fxFilter = ctx.createBiquadFilter();
  fxFilter.type = "lowpass";
  fxFilter.frequency.value = 2600;
  fxFilter.Q.value = 0.35;

  dryBus.connect(masterTone);
  masterTone.connect(compressor);

  fxBus.connect(delayA);
  delayA.connect(delayB);
  delayB.connect(fxFilter);
  fxFilter.connect(compressor);

  delayA.connect(feedbackA);
  feedbackA.connect(delayA);

  delayB.connect(feedbackB);
  feedbackB.connect(delayB);

  compressor.connect(master);
  master.connect(ctx.destination);

  return { master, dryBus, fxBus };
}

function scheduleOscVoice(
  ctx: AudioContext,
  buses: ReturnType<typeof createMixBuses>,
  {
    midi,
    start,
    duration,
    gain = 0.08,
    type = "triangle",
    attack = 0.01,
    release = 0.08,
    detune = 0,
    pan = 0,
    lowpassHz = 2600,
    sendAmount = 0.06,
  }: {
    midi: number;
    start: number;
    duration: number;
    gain?: number;
    type?: OscillatorType;
    attack?: number;
    release?: number;
    detune?: number;
    pan?: number;
    lowpassHz?: number;
    sendAmount?: number;
  }
) {
  if (!Number.isFinite(midi)) return;
  if (!Number.isFinite(start) || !Number.isFinite(duration) || duration <= 0) return;
  if (!Number.isFinite(gain) || gain <= 0) return;

  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = type;
  osc.frequency.setValueAtTime(midiToFreq(midi), start);
  osc.detune.setValueAtTime(detune, start);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(clamp(lowpassHz, 100, 12000), start);
  filter.Q.setValueAtTime(0.6, start);

  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.linearRampToValueAtTime(gain, start + Math.max(attack, 0.001));

  const sustainEnd = Math.max(start + attack, start + Math.max(0.04, duration - release));
  amp.gain.setValueAtTime(gain, sustainEnd);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  let lastNode: AudioNode = filter;

  if (typeof (ctx as any).createStereoPanner === "function") {
    const panner = (ctx as any).createStereoPanner();
    panner.pan.setValueAtTime(clamp(pan, -1, 1), start);
    filter.connect(panner);
    lastNode = panner;
  }

  const dryGain = ctx.createGain();
  dryGain.gain.value = 1;

  const fxGain = ctx.createGain();
  fxGain.gain.value = clamp(sendAmount, 0, 1);

  osc.connect(amp);
  amp.connect(filter);

  lastNode.connect(dryGain);
  dryGain.connect(buses.dryBus);

  lastNode.connect(fxGain);
  fxGain.connect(buses.fxBus);

  osc.start(start);
  osc.stop(start + duration + 0.03);
}

function scheduleLeadLayer(
  ctx: AudioContext,
  buses: ReturnType<typeof createMixBuses>,
  {
    midi,
    start,
    duration,
    tone,
    family,
  }: {
    midi: number;
    start: number;
    duration: number;
    tone: number;
    family: string;
  }
) {
  const softness = 1 - tone;
  const isDreamy = family === "dreamy_calm";
  const isWarm = family === "warm_grounded";
  const isEnergetic = family === "energetic_playful";

  const mainType: OscillatorType =
    tone < 0.25 ? "sine" : tone < 0.58 ? "triangle" : isEnergetic ? "sawtooth" : "triangle";

  const mainGain = 0.065 + tone * 0.02;
  const mainAttack = 0.01 + softness * 0.028;
  const mainRelease = 0.05 + softness * 0.12;
  const mainLowpass = 1200 + tone * 3500;

  scheduleOscVoice(ctx, buses, {
    midi,
    start,
    duration,
    gain: mainGain,
    type: mainType,
    attack: mainAttack,
    release: mainRelease,
    pan: -0.04,
    lowpassHz: mainLowpass,
    sendAmount: isDreamy ? 0.18 : 0.06,
  });

  scheduleOscVoice(ctx, buses, {
    midi,
    start,
    duration,
    gain: mainGain * 0.42,
    type: tone < 0.38 ? "triangle" : "sine",
    attack: mainAttack * 1.15,
    release: mainRelease * 1.12,
    detune: 4,
    pan: 0.04,
    lowpassHz: mainLowpass * 0.85,
    sendAmount: isDreamy ? 0.16 : 0.04,
  });

  if (tone > 0.6 || isDreamy) {
    scheduleOscVoice(ctx, buses, {
      midi: clamp(midi + 12, 48, 96),
      start: start + 0.01,
      duration: Math.max(0.05, duration * 0.32),
      gain: isWarm ? 0.006 : 0.01,
      type: "sine",
      attack: 0.005,
      release: 0.04,
      pan: 0.12,
      lowpassHz: 3400 + tone * 2200,
      sendAmount: isDreamy ? 0.18 : 0.06,
    });
  }
}

function scheduleLead(
  ctx: AudioContext,
  buses: ReturnType<typeof createMixBuses>,
  events: Array<{ midi: number; startStep: number; lengthSteps: number }>,
  stepSec: number,
  settings: PreviewSettings,
  family: string
) {
  for (const event of events) {
    const start = ctx.currentTime + event.startStep * stepSec;
    const duration = Math.max(
      0.09,
      event.lengthSteps * stepSec * (settings.energy > 0.72 ? 0.76 : 0.9)
    );

    scheduleLeadLayer(ctx, buses, {
      midi: event.midi,
      start,
      duration,
      tone: settings.tone,
      family,
    });
  }
}

function schedulePassingCluster(
  ctx: AudioContext,
  buses: ReturnType<typeof createMixBuses>,
  {
    baseMidi,
    start,
    stepSec,
    tone,
    energy,
    direction = 1,
    pan = 0.12,
    gain = 0.006,
    count = 2,
    bright = false,
  }: {
    baseMidi: number;
    start: number;
    stepSec: number;
    tone: number;
    energy: number;
    direction?: 1 | -1;
    pan?: number;
    gain?: number;
    count?: number;
    bright?: boolean;
  }
) {
  for (let i = 0; i < count; i++) {
    const midi = stepScaleMidi(baseMidi, direction * (i + 1));
    scheduleOscVoice(ctx, buses, {
      midi,
      start: start + i * stepSec * 0.34,
      duration: stepSec * (energy > 0.7 ? 0.28 : 0.38),
      gain: gain * (1 - i * 0.12),
      type: bright ? "triangle" : "sine",
      attack: 0.004,
      release: 0.035,
      pan: pan * (i % 2 === 0 ? 1 : -1),
      lowpassHz: (bright ? 3000 : 2200) + tone * 1800,
      sendAmount: bright ? 0.06 : 0.03,
    });
  }
}

function scheduleDreamySupport(
  ctx: AudioContext,
  buses: ReturnType<typeof createMixBuses>,
  root: number,
  events: Array<{ midi: number; startStep: number; lengthSteps: number }>,
  stepSec: number,
  settings: PreviewSettings
) {
  const c = settings.complexity;
  const t = settings.tone;

  for (let step = 0; step < 32; step += 8) {
    const start = ctx.currentTime + step * stepSec;
    const dur = stepSec * (7.8 + c * 2.8);

    scheduleOscVoice(ctx, buses, {
      midi: root + 12,
      start,
      duration: dur,
      gain: 0.016 + c * 0.01,
      type: t < 0.45 ? "sine" : "triangle",
      attack: 0.09,
      release: 0.24,
      pan: -0.2,
      lowpassHz: 1500 + t * 2000,
      sendAmount: 0.22,
    });

    if (c > 0.35) {
      scheduleOscVoice(ctx, buses, {
        midi: root + 19,
        start: start + 0.04,
        duration: dur * 0.9,
        gain: 0.01 + c * 0.006,
        type: "sine",
        attack: 0.09,
        release: 0.22,
        pan: 0.18,
        lowpassHz: 2200 + t * 1800,
        sendAmount: 0.24,
      });
    }
  }

  const responseStride = c < 0.42 ? 2 : 1;
  events.forEach((event, idx) => {
    if (idx % responseStride !== 0) return;

    const phraseEndStart =
      ctx.currentTime +
      (event.startStep + Math.max(1, Math.floor(event.lengthSteps * 0.72))) * stepSec;

    scheduleOscVoice(ctx, buses, {
      midi: clamp(event.midi + 12, 60, 86),
      start: phraseEndStart,
      duration: stepSec * 0.92,
      gain: 0.01 + t * 0.008,
      type: "sine",
      attack: 0.01,
      release: 0.08,
      pan: 0.24,
      lowpassHz: 3000 + t * 2000,
      sendAmount: 0.2,
    });

    if (c > 0.7) {
      schedulePassingCluster(ctx, buses, {
        baseMidi: event.midi + 12,
        start: phraseEndStart + stepSec * 0.3,
        stepSec,
        tone: t,
        energy: settings.energy,
        direction: 1,
        pan: -0.14,
        gain: 0.0055,
        count: 2,
        bright: true,
      });
    }
  });
}

function scheduleWarmSupport(
  ctx: AudioContext,
  buses: ReturnType<typeof createMixBuses>,
  root: number,
  events: Array<{ midi: number; startStep: number; lengthSteps: number }>,
  stepSec: number,
  settings: PreviewSettings
) {
  const c = settings.complexity;
  const t = settings.tone;
  const e = settings.energy;

  const spacing = e > 0.68 ? 2 : 4;

  for (let step = 0; step < 32; step += spacing) {
    const start = ctx.currentTime + step * stepSec;
    const dur = stepSec * (e > 0.68 ? 1.5 : 2.5);

    scheduleOscVoice(ctx, buses, {
      midi: root,
      start,
      duration: dur,
      gain: 0.022 + c * 0.012,
      type: t < 0.45 ? "triangle" : "sawtooth",
      attack: 0.02,
      release: 0.12,
      pan: -0.14,
      lowpassHz: 1050 + t * 1200,
      sendAmount: 0.04,
    });

    if (c > 0.28) {
      scheduleOscVoice(ctx, buses, {
        midi: root + 7,
        start,
        duration: dur * 0.92,
        gain: 0.011 + c * 0.007,
        type: "triangle",
        attack: 0.02,
        release: 0.1,
        pan: 0.08,
        lowpassHz: 1450 + t * 1200,
        sendAmount: 0.03,
      });
    }

    if (c > 0.72) {
      scheduleOscVoice(ctx, buses, {
        midi: root + 12,
        start: start + 0.02,
        duration: dur * 0.74,
        gain: 0.007,
        type: "sine",
        attack: 0.015,
        release: 0.08,
        pan: 0.16,
        lowpassHz: 2200 + t * 1000,
        sendAmount: 0.02,
      });
    }
  }

  events.forEach((event) => {
    if (event.lengthSteps < 2 || c < 0.52) return;

    const start = ctx.currentTime + event.startStep * stepSec + 0.01;

    scheduleOscVoice(ctx, buses, {
      midi: clamp(event.midi - 12, 48, 72),
      start,
      duration: Math.max(0.08, event.lengthSteps * stepSec * 0.6),
      gain: 0.01 + c * 0.005,
      type: "sine",
      attack: 0.015,
      release: 0.1,
      pan: -0.08,
      lowpassHz: 920 + t * 700,
      sendAmount: 0.02,
    });

    if (c > 0.78) {
      scheduleOscVoice(ctx, buses, {
        midi: clamp(event.midi - 5, 48, 76),
        start: start + stepSec * 0.4,
        duration: stepSec * 0.55,
        gain: 0.0055,
        type: "triangle",
        attack: 0.01,
        release: 0.06,
        pan: 0.02,
        lowpassHz: 1600 + t * 900,
        sendAmount: 0.02,
      });
    }
  });
}

function scheduleGentleSupport(
  ctx: AudioContext,
  buses: ReturnType<typeof createMixBuses>,
  root: number,
  events: Array<{ midi: number; startStep: number; lengthSteps: number }>,
  stepSec: number,
  settings: PreviewSettings
) {
  const c = settings.complexity;
  const t = settings.tone;
  const e = settings.energy;

  for (let step = 0; step < 32; step += 8) {
    const start = ctx.currentTime + step * stepSec;

    scheduleOscVoice(ctx, buses, {
      midi: root,
      start,
      duration: stepSec * (4.4 + c * 1.2),
      gain: 0.013 + c * 0.004,
      type: t < 0.42 ? "sine" : "triangle",
      attack: 0.04,
      release: 0.18,
      pan: -0.1,
      lowpassHz: 1200 + t * 1100,
      sendAmount: 0.1,
    });
  }

  const responseStride = e > 0.62 ? 1 : 2;
  events.forEach((event, idx) => {
    if (idx % responseStride !== 0) return;

    const start =
      ctx.currentTime + (event.startStep + event.lengthSteps - 1) * stepSec + 0.01;

    scheduleOscVoice(ctx, buses, {
      midi: clamp(event.midi + 7, 55, 84),
      start,
      duration: stepSec * 0.72,
      gain: 0.007 + t * 0.004,
      type: "sine",
      attack: 0.01,
      release: 0.07,
      pan: 0.12,
      lowpassHz: 1800 + t * 1200,
      sendAmount: 0.09,
    });

    if (c > 0.78) {
      schedulePassingCluster(ctx, buses, {
        baseMidi: event.midi + 7,
        start: start + stepSec * 0.32,
        stepSec,
        tone: t,
        energy: e,
        direction: 1,
        pan: -0.08,
        gain: 0.0042,
        count: 2,
        bright: false,
      });
    }
  });
}

function scheduleEnergeticSupport(
  ctx: AudioContext,
  buses: ReturnType<typeof createMixBuses>,
  root: number,
  events: Array<{ midi: number; startStep: number; lengthSteps: number }>,
  stepSec: number,
  settings: PreviewSettings
) {
  const c = settings.complexity;
  const t = settings.tone;
  const e = settings.energy;

  const spacing = e > 0.72 ? 1 : 2;
  const pattern = [root, root + 7, root + 12, root + 7];
  let pulseIndex = 0;

  for (let step = 1; step < 32; step += spacing) {
    const start = ctx.currentTime + step * stepSec;
    const midi = pattern[pulseIndex % pattern.length];
    pulseIndex += 1;

    scheduleOscVoice(ctx, buses, {
      midi,
      start,
      duration: stepSec * (e > 0.72 ? 0.6 : 0.9),
      gain: 0.018 + e * 0.01 + c * 0.008,
      type: t > 0.58 ? "sawtooth" : "triangle",
      attack: 0.004,
      release: 0.04,
      pan: step % 4 === 1 ? -0.14 : 0.14,
      lowpassHz: 1900 + t * 2300,
      sendAmount: 0.025,
    });

    if (c > 0.58) {
      scheduleOscVoice(ctx, buses, {
        midi: clamp(midi + 12, 60, 86),
        start: start + stepSec * 0.14,
        duration: stepSec * 0.3,
        gain: 0.006 + e * 0.004,
        type: "triangle",
        attack: 0.003,
        release: 0.03,
        pan: 0.06,
        lowpassHz: 3200 + t * 1600,
        sendAmount: 0.02,
      });
    }

    if (c > 0.82) {
      schedulePassingCluster(ctx, buses, {
        baseMidi: midi + 12,
        start: start + stepSec * 0.22,
        stepSec,
        tone: t,
        energy: e,
        direction: 1,
        pan: -0.04,
        gain: 0.0048,
        count: 2,
        bright: true,
      });
    }
  }

  const onsetStride = c > 0.68 ? 1 : 2;
  events.forEach((event, idx) => {
    if (idx % onsetStride !== 0) return;

    const start = ctx.currentTime + event.startStep * stepSec + stepSec * 0.38;

    scheduleOscVoice(ctx, buses, {
      midi: clamp(event.midi + 12, 60, 86),
      start,
      duration: stepSec * 0.4,
      gain: 0.009 + e * 0.006,
      type: "triangle",
      attack: 0.003,
      release: 0.032,
      pan: 0.22,
      lowpassHz: 2600 + t * 1800,
      sendAmount: 0.025,
    });
  });
}

function scheduleNeutralSupport(
  ctx: AudioContext,
  buses: ReturnType<typeof createMixBuses>,
  root: number,
  events: Array<{ midi: number; startStep: number; lengthSteps: number }>,
  stepSec: number,
  settings: PreviewSettings
) {
  const c = settings.complexity;
  const t = settings.tone;
  const e = settings.energy;

  const spacing = c < 0.32 ? 8 : c < 0.62 ? 4 : 2;

  for (let step = 0; step < 32; step += spacing) {
    const start = ctx.currentTime + step * stepSec;
    const dur = stepSec * (e > 0.65 ? 1.35 : spacing * 0.76);

    scheduleOscVoice(ctx, buses, {
      midi: root,
      start,
      duration: dur,
      gain: 0.018 + c * 0.009,
      type: t < 0.45 ? "triangle" : "sawtooth",
      attack: 0.01,
      release: 0.08,
      pan: -0.12,
      lowpassHz: 1500 + t * 1600,
      sendAmount: 0.04,
    });

    if (c > 0.4) {
      scheduleOscVoice(ctx, buses, {
        midi: root + 7,
        start,
        duration: dur * 0.88,
        gain: 0.009 + c * 0.006,
        type: "sine",
        attack: 0.01,
        release: 0.07,
        pan: 0.1,
        lowpassHz: 2000 + t * 1200,
        sendAmount: 0.03,
      });
    }
  }

  if (c > 0.72) {
    events.forEach((event, idx) => {
      if (idx % 2 !== 0) return;

      const start = ctx.currentTime + event.startStep * stepSec + stepSec * 0.48;

      scheduleOscVoice(ctx, buses, {
        midi: clamp(event.midi + 12, 60, 84),
        start,
        duration: stepSec * 0.52,
        gain: 0.0065,
        type: "triangle",
        attack: 0.005,
        release: 0.045,
        pan: 0.1,
        lowpassHz: 2500 + t * 1200,
        sendAmount: 0.03,
      });
    });
  }
}

export function playDraftPreview(input: DraftPreviewInput) {
  stopDraftPreview();

  const melodySteps = (input.melodySteps || []).slice(0, 32);
  while (melodySteps.length < 32) melodySteps.push(0);

  const leadEvents = buildMelodyEvents(melodySteps);
  if (leadEvents.length === 0) {
    throw new Error("No melody found for preview.");
  }

  const baseSettings = {
    complexity: clamp(input.settings.complexity ?? 0.35, 0, 1),
    tone: clamp(input.settings.tone ?? 0.3, 0, 1),
    energy: clamp(input.settings.energy ?? 0.25, 0, 1),
  };

  const controls: CoCreationControls = {
    supportAmount: input.controls?.supportAmount ?? "balanced",
    supportRegister: input.controls?.supportRegister ?? "balanced",
    instrumentColor: input.controls?.instrumentColor ?? "balanced",
  };

  const supportAmountOffset =
    controls.supportAmount === "less" ? -0.26 :
    controls.supportAmount === "more" ? 0.26 : 0;

  const instrumentToneOffset =
    controls.instrumentColor === "softer" ? -0.22 :
    controls.instrumentColor === "brighter" ? 0.22 : 0;

  const registerShift =
    controls.supportRegister === "lower" ? -1 :
    controls.supportRegister === "higher" ? 1 : 0;

  const supportSettings = {
    complexity: clamp(baseSettings.complexity + supportAmountOffset, 0, 1),
    tone: clamp(baseSettings.tone + instrumentToneOffset, 0, 1),
    energy: baseSettings.energy,
  };

  const family = input.card?.family_key || "neutral_supportive";

  const ctx = getAudioContext();
  activeCtx = ctx;

  if (ctx.state === "suspended") {
    ctx.resume();
  }

  const buses = createMixBuses(ctx);
  activeMaster = buses.master;

  const avgMidi =
    leadEvents.reduce((sum, event) => sum + event.midi, 0) / Math.max(1, leadEvents.length);

  const root = nearestScaleMidi(avgMidi - 12);
  const supportRoot = shiftMidiInScale(root, registerShift);
  const supportEvents = leadEvents.map((event) => ({
    ...event,
    midi: clamp(shiftMidiInScale(event.midi, registerShift), 48, 96),
  }));

  // keep tempo shift subtle
  const stepSec = 0.18 - baseSettings.energy * 0.01;

  // Lead melody remains locked and uses original refinement settings
  scheduleLead(ctx, buses, leadEvents, stepSec, baseSettings, family);

  // Co-creation controls only affect support / response layer
  if (family === "dreamy_calm") {
    scheduleDreamySupport(ctx, buses, supportRoot, supportEvents, stepSec, supportSettings);
  } else if (family === "warm_grounded") {
    scheduleWarmSupport(ctx, buses, supportRoot, supportEvents, stepSec, supportSettings);
  } else if (family === "gentle_reflective") {
    scheduleGentleSupport(ctx, buses, supportRoot, supportEvents, stepSec, supportSettings);
  } else if (family === "energetic_playful") {
    scheduleEnergeticSupport(ctx, buses, supportRoot, supportEvents, stepSec, supportSettings);
  } else {
    scheduleNeutralSupport(ctx, buses, supportRoot, supportEvents, stepSec, supportSettings);
  }

  const durationMs = Math.round(32 * stepSec * 1000 + 540);

  activeStopTimeout = window.setTimeout(() => {
    cleanupContext();
  }, durationMs + 120);

  return {
    durationMs,
  };
}