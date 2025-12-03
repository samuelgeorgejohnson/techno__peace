# @technopeace/codex-audio

Python DSP helpers for TechnoPeace.

Maps **environmental signals** (cloudCover, windMps, sunAltitudeDeg, moonPhase)
into **audio blocks**: sine bed + wind noise + LFO modulation.

## Core ideas

- Base sine stack → gain scaled by `(1 - cloudCover)`
- Wind speed → noise level + low-pass cutoff
- Sun altitude → LFO rate (brighter sun = faster modulation)
- Moon phase → LFO depth (full moon = stronger tremolo)

## Files

- `render_core.py` – sine / noise generators, filters, LFO
- `render_block.py` – render a single block from an HourlySignal dict
- `compose_day.py` – stitch 24 blocks into a day-long WAV
- `cli.py` – simple test CLI

## Quickstart

```bash
cd packages/codex-audio
python -m venv .venv
source .venv/bin/activate  # (on macOS/Linux)
pip install -r requirements.txt

python -m codex_audio.cli \
  --out out.wav \
  --cloud 0.3 --wind 4.0 --sun 35 --moon 0.6
```
