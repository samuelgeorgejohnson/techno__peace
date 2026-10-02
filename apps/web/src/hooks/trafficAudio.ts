import type { RoadSignal } from "@technopeace/codex-data/types/ManMadeSignals";

const unit = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

/** Artistic daily activity, using fractional device-local hours; not a traffic estimate. */
export function trafficTimeActivity(localHour: number) {
  const hour = Number.isFinite(localHour) ? ((localHour % 24) + 24) % 24 : 0;
  const points = [
    [0, 0.15], [3, 0.10], [5, 0.20], [6, 0.40], [9, 0.65],
    [10, 0.75], [11, 0.85], [12, 0.95], [13, 1], [14, 0.95],
    [15, 0.80], [18, 0.60], [19, 0.50], [22, 0.30], [23, 0.20], [24, 0.15],
  ];
  for (let i = 1; i < points.length; i += 1) {
    const [end, b] = points[i];
    const [start, a] = points[i - 1];
    if (hour <= end) {
      const t = (hour - start) / (end - start);
      return a + (b - a) * t * t * (3 - 2 * t);
    }
  }
  return 0.15;
}

export function deriveTrafficActivity(localHour: number, road?: RoadSignal | null, reliable = false) {
  const fallback = trafficTimeActivity(localHour);
  const values = road?.normalized;
  if (!reliable || !values || ![values.density, values.motion, values.proximity].every(Number.isFinite)) {
    return { activity: fallback, proximity: 0.35, live: false };
  }
  // Density represents congestion in the adapter. Flow retains authority on clear roads.
  const proximity = unit(values.proximity);
  const liveActivity = 0.45 * unit(values.density) + 0.45 * unit(values.motion) + 0.10 * proximity;
  return { activity: unit(0.85 * liveActivity + 0.15 * fallback), proximity, live: true };
}

/** Independent ecological clock: 7–55 seconds per opportunity, with skipped opportunities. */
export function trafficEventTiming(activity: number, random = Math.random()) {
  const a = unit(activity);
  const minimumInterval = 7 + 23 * (1 - a);
  return {
    probability: 0.25 + 0.65 * a,
    minimumInterval,
    interval: minimumInterval + unit(random) * (3 + 22 * (1 - a)),
  };
}

/** One bounded synthetic approach/recede; caller reuses the graph's noise buffer. */
export function triggerTrafficPass(
  ctx: AudioContext,
  destination: AudioNode,
  buffer: AudioBuffer,
  start: number,
  proximity: number,
  onComplete: () => void,
) {
  const near = unit(proximity);
  const duration = 1.5 + Math.random() * 3.5;
  const peak = start + duration * (0.40 + Math.random() * 0.15);
  const end = start + duration;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  const engine = ctx.createOscillator();
  engine.type = "sine";
  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 45;
  highpass.Q.value = 0.7;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.Q.value = 0.6;
  const bandwidth = 260 + 1100 * near;
  lowpass.frequency.setValueAtTime(bandwidth * 0.45, start);
  lowpass.frequency.linearRampToValueAtTime(bandwidth, peak);
  lowpass.frequency.exponentialRampToValueAtTime(bandwidth * 0.35, end);
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.45 + Math.random() * 0.30;
  const engineGain = ctx.createGain();
  engineGain.gain.value = 0.10 + 0.08 * near + Math.random() * 0.04;
  const hz = 42 + Math.random() * 48;
  engine.frequency.setValueAtTime(hz * 1.025, start);
  engine.frequency.linearRampToValueAtTime(hz * 1.04, peak);
  engine.frequency.exponentialRampToValueAtTime(hz * 0.96, end);
  const envelope = ctx.createGain();
  const amplitude = (0.028 + 0.028 * near) * (0.8 + Math.random() * 0.2);
  envelope.gain.setValueAtTime(0, start);
  envelope.gain.linearRampToValueAtTime(amplitude * 0.16, start + duration * 0.18);
  envelope.gain.linearRampToValueAtTime(amplitude, peak);
  envelope.gain.exponentialRampToValueAtTime(0.00001, end);
  envelope.gain.setValueAtTime(0, end + 0.01);
  const panner = typeof ctx.createStereoPanner === "function" ? ctx.createStereoPanner() : null;
  if (panner) {
    const direction = Math.random() < 0.5 ? -1 : 1;
    const width = 0.25 + 0.60 * near;
    panner.pan.setValueAtTime(direction * width, start);
    panner.pan.linearRampToValueAtTime(0, peak);
    panner.pan.linearRampToValueAtTime(-direction * width, end);
  }
  noise.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(noiseGain);
  noiseGain.connect(envelope);
  engine.connect(engineGain);
  engineGain.connect(envelope);
  if (panner) { envelope.connect(panner); panner.connect(destination); }
  else envelope.connect(destination);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    noise.onended = null;
    engine.onended = null;
    for (const node of [noise, engine, highpass, lowpass, noiseGain, engineGain, envelope, panner]) node?.disconnect();
    onComplete();
  };
  // Both sources have the same explicit stop time. Cleanup waits for both ended events.
  let ended = 0;
  const sourceEnded = () => { ended += 1; if (ended === 2) cleanup(); };
  noise.onended = sourceEnded;
  engine.onended = sourceEnded;
  noise.start(start, Math.random() * buffer.duration);
  engine.start(start);
  noise.stop(end + 0.02);
  engine.stop(end + 0.02);
  return () => {
    try { noise.stop(); } catch { /* Already stopped. */ }
    try { engine.stop(); } catch { /* Already stopped. */ }
    cleanup();
  };
}
