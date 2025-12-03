"""
Core DSP primitives for TechnoPeace audio.

- Sine stack (base harmonic bed)
- White noise
- Simple low-pass filter (Butterworth)
- LFO-based amplitude modulation
"""

from __future__ import annotations
import numpy as np
from scipy.signal import butter, lfilter


def generate_sine_stack(
    duration_s: float,
    sample_rate: int,
    freqs: list[float],
    amplitude: float = 0.3,
) -> np.ndarray:
    """Sum a stack of sines at given frequencies."""
    t = np.linspace(0.0, duration_s, int(sample_rate * duration_s), endpoint=False)
    sig = np.zeros_like(t)
    for f in freqs:
        sig += np.sin(2.0 * np.pi * f * t)
    if len(freqs) > 0:
        sig *= amplitude / len(freqs)
    return sig.astype(np.float32)


def generate_noise(
    duration_s: float,
    sample_rate: int,
    amplitude: float = 0.2,
) -> np.ndarray:
    """Simple white noise."""
    n_samples = int(sample_rate * duration_s)
    sig = amplitude * np.random.randn(n_samples)
    return sig.astype(np.float32)


def low_pass_filter(
    signal: np.ndarray,
    cutoff_hz: float,
    sample_rate: int,
    order: int = 4,
) -> np.ndarray:
    """
    Butterworth low-pass filter.

    cutoff_hz is clamped into (0, Nyquist).
    """
    nyq = sample_rate / 2.0
    cutoff = max(10.0, min(cutoff_hz, nyq * 0.99))
    b, a = butter(order, cutoff / nyq, btype="low")
    return lfilter(b, a, signal).astype(np.float32)


def apply_lfo(
    signal: np.ndarray,
    rate_hz: float,
    depth: float = 0.3,
    sample_rate: int = 48_000,
) -> np.ndarray:
    """
    Apply sine LFO amplitude modulation.

    depth in [0,1] => 0 = no modulation, 1 = full on/off tremolo.
    """
    depth = float(max(0.0, min(depth, 1.0)))
    rate = max(0.01, float(rate_hz))
    t = np.arange(len(signal)) / float(sample_rate)
    lfo = 1.0 + depth * np.sin(2.0 * np.pi * rate * t)
    return (signal * lfo).astype(np.float32)
