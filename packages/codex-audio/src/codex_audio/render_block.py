"""
Render a single TechnoPeace audio block from an HourlySignal-like dict.

Expected `signals` shape:

{
  "hour": int,             # 0–23 (unused in DSP, useful for logs)
  "cloudCover": float,     # 0–1  (0 = clear, 1 = overcast)
  "windMps": float,        # m/s  (0+)
  "sunAltitudeDeg": float, # -90–+90 (below/above horizon)
  "moonPhase": float,      # 0–1 (0 = new, 1 = full)
}
"""

from __future__ import annotations
from typing import Mapping, Any

import numpy as np
import soundfile as sf

from .render_core import (
    generate_sine_stack,
    generate_noise,
    low_pass_filter,
    apply_lfo,
)


DEFAULT_SAMPLE_RATE = 48_000


def render_block(
    signals: Mapping[str, Any],
    duration_s: float = 60.0,
    sample_rate: int = DEFAULT_SAMPLE_RATE,
) -> np.ndarray:
    # Extract and clamp inputs
    cloud = float(signals.get("cloudCover", 0.0))
    cloud = max(0.0, min(cloud, 1.0))

    wind = float(signals.get("windMps", 0.0))
    wind = max(0.0, wind)

    sun_alt = float(signals.get("sunAltitudeDeg", 0.0))
    # clamp to [-90, 90]
    sun_alt = max(-90.0, min(sun_alt, 90.0))

    moon_phase = float(signals.get("moonPhase", 0.0))
    moon_phase = max(0.0, min(moon_phase, 1.0))

    # --- Base sine bed ---
    # Darker sky (more cloud) = quieter base.
    base_amp = 0.4 * (1.0 - cloud)  # 0–0.4
    base = generate_sine_stack(
        duration_s=duration_s,
        sample_rate=sample_rate,
        freqs=[55.0, 110.0, 220.0],
        amplitude=base_amp,
    )

    # --- Wind noise ---
    # More wind = louder noise and brighter filter.
    noise_amp = min(wind / 10.0, 1.0) * 0.4  # up to 0.4
    noise = generate_noise(
        duration_s=duration_s,
        sample_rate=sample_rate,
        amplitude=noise_amp,
    )

    # LPF cutoff from wind: calm = darker, storm = brighter.
    cutoff = 500.0 + 1500.0 * (min(wind, 15.0) / 15.0)
    noise = low_pass_filter(noise, cutoff_hz=cutoff, sample_rate=sample_rate)

    # --- Mix base + wind ---
    mix = base + noise

    # --- Sun + Moon LFO ---
    # Map sun altitude [-90,90] to [0.05, 0.6] Hz
    sun_norm = (sun_alt + 90.0) / 180.0  # 0–1
    lfo_rate = 0.05 + 0.55 * sun_norm
    lfo_depth = 0.15 + 0.45 * moon_phase  # new moon subtle, full moon deep

    mix = apply_lfo(
        signal=mix,
        rate_hz=lfo_rate,
        depth=lfo_depth,
        sample_rate=sample_rate,
    )

    # Safety: soft limiter
    max_abs = float(np.max(np.abs(mix))) or 1.0
    if max_abs > 0.99:
        mix = mix / max_abs * 0.98

    return mix.astype("float32")


def write_wav(path: str, signal: np.ndarray, sample_rate: int = DEFAULT_SAMPLE_RATE) -> None:
    """Write mono WAV."""
    sf.write(path, signal, sample_rate)
