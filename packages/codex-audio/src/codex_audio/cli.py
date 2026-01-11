"""
Small CLI to quickly test the renderer.

Example:

  python -m codex_audio.cli \
    --out demo.wav \
    --cloud 0.3 --wind 4 --sun 25 --moon 0.7
"""

from __future__ import annotations
import argparse
from pathlib import Path

from .render_block import render_block, write_wav


def main() -> None:
    parser = argparse.ArgumentParser(description="TechnoPeace audio test renderer")
    parser.add_argument("--out", type=str, default="demo.wav", help="Output WAV path")
    parser.add_argument("--duration", type=float, default=60.0, help="Duration in seconds")
    parser.add_argument("--cloud", type=float, default=0.2, help="Cloud cover 0–1")
    parser.add_argument("--wind", type=float, default=3.0, help="Wind speed m/s")
    parser.add_argument("--sun", type=float, default=30.0, help="Sun altitude deg (-90–90)")
    parser.add_argument("--moon", type=float, default=0.5, help="Moon phase 0–1")

    args = parser.parse_args()

    signal = {
        "hour": 12,
        "cloudCover": args.cloud,
        "windMps": args.wind,
        "sunAltitudeDeg": args.sun,
        "moonPhase": args.moon,
    }

    block = render_block(signal, duration_s=args.duration)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    write_wav(str(out_path), block)

    print(f"Wrote {args.duration:.1f}s block to {out_path}")


if __name__ == "__main__":
    main()
