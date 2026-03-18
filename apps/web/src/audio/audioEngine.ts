export type ChaosParams = {
  x: number;
  y: number;
  pressure: number;
};

export type MixerParams = {
  master: number;
  wind: number;
  rain: number;
  shimmer: number;
  pulse: number;
};

const DEFAULT_MIXER: MixerParams = {
  master: 0.72,
  wind: 0.42,
  rain: 0.28,
  shimmer: 0.56,
  pulse: 0.34,
};

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

class AudioEngine {
  private context: AudioContext | null = null;
  private started = false;

  private masterGain: GainNode | null = null;
  private mainOsc: OscillatorNode | null = null;
  private subOsc: OscillatorNode | null = null;
  private shimmerOsc: OscillatorNode | null = null;
  private tonalFilter: BiquadFilterNode | null = null;

  private windSource: AudioBufferSourceNode | null = null;
  private rainSource: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;

  private tonalGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private shimmerGain: GainNode | null = null;

  private pulseLfo: OscillatorNode | null = null;
  private pulseDepth: GainNode | null = null;
  private windMotionLfo: OscillatorNode | null = null;
  private windMotionDepth: GainNode | null = null;
  private rainPanLfo: OscillatorNode | null = null;
  private rainPanDepth: GainNode | null = null;
  private rainPanner: StereoPannerNode | null = null;

  private runningListeners = new Set<(isRunning: boolean) => void>();

  private chaos: ChaosParams = { x: 0.5, y: 0.5, pressure: 0 };
  private mixer: MixerParams = { ...DEFAULT_MIXER };

  private ensureContext() {
    if (this.context) return this.context;
    this.context = new (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
    return this.context;
  }

  subscribe(listener: (isRunning: boolean) => void) {
    this.runningListeners.add(listener);
    listener(this.isRunning());
    return () => {
      this.runningListeners.delete(listener);
    };
  }

  isRunning() {
    return this.context?.state === "running";
  }

  getMixerParams() {
    return { ...this.mixer };
  }

  async start() {
    const context = this.ensureContext();

    if (!this.started) {
      this.buildGraph(context);
      this.started = true;
    }

    if (context.state !== "running") {
      await context.resume();
    }

    this.notifyRunning();
    this.applyCurrentState(true);
  }

  updateChaos(params: ChaosParams) {
    this.chaos = {
      x: clamp(params.x),
      y: clamp(params.y),
      pressure: clamp(params.pressure),
    };

    if (this.started) {
      this.applyCurrentState();
    }
  }

  updateMixer(patch: Partial<MixerParams>) {
    this.mixer = {
      ...this.mixer,
      ...Object.fromEntries(
        Object.entries(patch).map(([key, value]) => [key, clamp(value ?? this.mixer[key as keyof MixerParams])]),
      ),
    } as MixerParams;

    if (this.started) {
      this.applyCurrentState();
    }
  }

  async suspend() {
    if (!this.context) return;
    this.masterGain?.gain.setTargetAtTime(0.0001, this.context.currentTime, 0.12);
    window.setTimeout(async () => {
      if (!this.context) return;
      try {
        await this.context.suspend();
        this.notifyRunning();
      } catch {
        // Ignore suspend errors.
      }
    }, 180);
  }

  dispose() {
    if (!this.context) return;

    for (const source of [this.windSource, this.rainSource]) {
      try {
        source?.stop();
      } catch {
        // ignore repeated stop calls
      }
    }

    for (const osc of [this.mainOsc, this.subOsc, this.shimmerOsc, this.pulseLfo, this.windMotionLfo, this.rainPanLfo]) {
      try {
        osc?.stop();
      } catch {
        // ignore repeated stop calls
      }
    }

    void this.context.close();
    this.context = null;
    this.started = false;
    this.notifyRunning();
  }

  private notifyRunning() {
    const running = this.isRunning();
    for (const listener of this.runningListeners) {
      listener(running);
    }
  }

  private buildGraph(context: AudioContext) {
    const masterGain = context.createGain();
    masterGain.gain.value = 0.0001;
    masterGain.connect(context.destination);
    this.masterGain = masterGain;

    const tonalFilter = context.createBiquadFilter();
    tonalFilter.type = "lowpass";
    tonalFilter.frequency.value = 1400;
    tonalFilter.Q.value = 0.9;
    tonalFilter.connect(masterGain);
    this.tonalFilter = tonalFilter;

    const tonalGain = context.createGain();
    tonalGain.gain.value = 0.12;
    tonalGain.connect(tonalFilter);
    this.tonalGain = tonalGain;

    const mainOsc = context.createOscillator();
    mainOsc.type = "triangle";
    mainOsc.frequency.value = 132;
    mainOsc.connect(tonalGain);
    mainOsc.start();
    this.mainOsc = mainOsc;

    const subOsc = context.createOscillator();
    subOsc.type = "sine";
    subOsc.frequency.value = 66;
    subOsc.connect(tonalGain);
    subOsc.start();
    this.subOsc = subOsc;

    const shimmerGain = context.createGain();
    shimmerGain.gain.value = 0.02;
    shimmerGain.connect(masterGain);
    this.shimmerGain = shimmerGain;

    const shimmerOsc = context.createOscillator();
    shimmerOsc.type = "sine";
    shimmerOsc.frequency.value = 396;
    shimmerOsc.connect(shimmerGain);
    shimmerOsc.start();
    this.shimmerOsc = shimmerOsc;

    const windFilter = context.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 900;
    windFilter.Q.value = 0.4;
    windFilter.connect(masterGain);
    this.windFilter = windFilter;

    const windGain = context.createGain();
    windGain.gain.value = 0.02;
    windGain.connect(windFilter);
    this.windGain = windGain;

    const windSource = this.createNoiseSource(context, 1.5, 0.55);
    windSource.connect(windGain);
    windSource.start();
    this.windSource = windSource;

    const rainPanner = context.createStereoPanner();
    rainPanner.connect(masterGain);
    this.rainPanner = rainPanner;

    const rainFilter = context.createBiquadFilter();
    rainFilter.type = "highpass";
    rainFilter.frequency.value = 1500;
    rainFilter.Q.value = 0.8;
    rainFilter.connect(rainPanner);
    this.rainFilter = rainFilter;

    const rainGain = context.createGain();
    rainGain.gain.value = 0.01;
    rainGain.connect(rainFilter);
    this.rainGain = rainGain;

    const rainSource = this.createNoiseSource(context, 0.35, 0.9);
    rainSource.playbackRate.value = 1.8;
    rainSource.connect(rainGain);
    rainSource.start();
    this.rainSource = rainSource;

    const pulseLfo = context.createOscillator();
    pulseLfo.type = "sine";
    pulseLfo.frequency.value = 0.18;
    this.pulseLfo = pulseLfo;

    const pulseDepth = context.createGain();
    pulseDepth.gain.value = 0.01;
    pulseLfo.connect(pulseDepth);
    pulseDepth.connect(masterGain.gain);
    pulseLfo.start();
    this.pulseDepth = pulseDepth;

    const windMotionLfo = context.createOscillator();
    windMotionLfo.type = "sine";
    windMotionLfo.frequency.value = 0.08;
    this.windMotionLfo = windMotionLfo;

    const windMotionDepth = context.createGain();
    windMotionDepth.gain.value = 120;
    windMotionLfo.connect(windMotionDepth);
    windMotionDepth.connect(windFilter.frequency);
    windMotionLfo.start();
    this.windMotionDepth = windMotionDepth;

    const rainPanLfo = context.createOscillator();
    rainPanLfo.type = "sine";
    rainPanLfo.frequency.value = 0.13;
    this.rainPanLfo = rainPanLfo;

    const rainPanDepth = context.createGain();
    rainPanDepth.gain.value = 0.15;
    rainPanLfo.connect(rainPanDepth);
    rainPanDepth.connect(rainPanner.pan);
    rainPanLfo.start();
    this.rainPanDepth = rainPanDepth;
  }

  private createNoiseSource(context: AudioContext, durationSeconds: number, scale: number) {
    const frameCount = Math.max(1, Math.floor(context.sampleRate * durationSeconds));
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < frameCount; index += 1) {
      data[index] = (Math.random() * 2 - 1) * scale;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
  }

  private applyCurrentState(force = false) {
    if (!this.context) return;

    const now = this.context.currentTime;
    const { x, y, pressure } = this.chaos;
    const { master, wind, rain, shimmer, pulse } = this.mixer;

    const baseHz = 68 + 220 * Math.pow(x, 1.35);
    const harmonicHz = baseHz * (1.48 + shimmer * 0.8);
    const lowpassHz = 420 + 5000 * Math.pow(1 - y, 1.5) + shimmer * 600;

    const tonalGain = 0.05 + 0.14 * pressure + shimmer * 0.08;
    const windGain = 0.01 + wind * (0.12 + (1 - y) * 0.1) + pressure * 0.03;
    const rainGain = 0.005 + rain * (0.08 + y * 0.18 + pressure * 0.05);
    const shimmerGain = 0.002 + shimmer * (0.025 + (1 - y) * 0.05);
    const masterGain = Math.max(0.0001, master * (0.12 + pressure * 0.12));

    const pulseRate = 0.06 + pulse * 0.8 + (1 - y) * 0.15;
    const pulseDepth = 0.004 + pulse * (0.015 + pressure * 0.045);
    const windMotion = 90 + wind * 420 + pressure * 80;
    const rainPanWidth = 0.05 + rain * 0.55;
    const rainTone = 1800 + rain * 2800 + (1 - y) * 600;

    const ramp = force ? 0.01 : 0.05;

    this.mainOsc?.frequency.setTargetAtTime(baseHz, now, ramp);
    this.subOsc?.frequency.setTargetAtTime(baseHz / 2, now, ramp * 1.3);
    this.shimmerOsc?.frequency.setTargetAtTime(harmonicHz, now, ramp * 1.2);

    this.tonalFilter?.frequency.setTargetAtTime(lowpassHz, now, ramp);
    this.tonalGain?.gain.setTargetAtTime(tonalGain, now, ramp);
    this.windGain?.gain.setTargetAtTime(windGain, now, ramp * 1.15);
    this.rainGain?.gain.setTargetAtTime(rainGain, now, ramp * 1.15);
    this.shimmerGain?.gain.setTargetAtTime(shimmerGain, now, ramp);
    this.masterGain?.gain.setTargetAtTime(masterGain, now, ramp);

    this.windFilter?.frequency.setTargetAtTime(550 + wind * 1300 + (1 - y) * 400, now, ramp);
    this.windFilter?.Q.setTargetAtTime(0.4 + wind * 0.8, now, ramp);
    this.rainFilter?.frequency.setTargetAtTime(rainTone, now, ramp);

    this.pulseLfo?.frequency.setTargetAtTime(pulseRate, now, ramp * 1.2);
    this.pulseDepth?.gain.setTargetAtTime(pulseDepth, now, ramp * 1.2);
    this.windMotionLfo?.frequency.setTargetAtTime(0.05 + wind * 0.25, now, ramp * 1.4);
    this.windMotionDepth?.gain.setTargetAtTime(windMotion, now, ramp * 1.4);
    this.rainPanLfo?.frequency.setTargetAtTime(0.08 + rain * 0.4, now, ramp * 1.3);
    this.rainPanDepth?.gain.setTargetAtTime(rainPanWidth, now, ramp * 1.3);
  }
}

export const audioEngine = new AudioEngine();
export { DEFAULT_MIXER };
