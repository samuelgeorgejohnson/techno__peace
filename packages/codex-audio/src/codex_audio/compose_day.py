"""
Helpers to render multiple HourlySignal blocks and join them into a day-long file.
"""

from __future__ import annotations
from typing import Sequence, Mapping, Any
import pathlib

import numpy as np

from .render_block import render_block, write_wav, DEFAULT_SAMPLE_RATE


def compose_day(
    hours: Sequence[Mapping[str, Any]],
    duration_s: float = 60.0,
    sample_rate: int = DEFAULT_SAMPLE_RATE,
    out_path: str | pathlib.Path | None = None,
) -> np.ndarray:
    """
    Render each hourly signal into a block and concatenate.

    If out_path is provided, writes the full day to WAV.
    Returns the concatenated numpy array either way.
    """
    blocks: list[np.ndarray] = []
    for sig in hours:
        block = render_block(sig, duration_s=duration_s, sample_rate=sample_rate)
        blocks.append(block)

    full = np.concatenate(blocks) if blocks else np.zeros(0, dtype="float32")

    if out_path is not None:
        out_path = pathlib.Path(out_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        write_wav(str(out_path), full, sample_rate=sample_rate)

    return full
