# TechnoPeace Signal Aggregator Overview

TechnoPeace converts daily environmental and celestial signals into shareable audio and visual artifacts.
This document sketches how raw sources flow into the monorepo components and back out to the browser.

## Signal Ingest
- Weather and astronomy data are fetched for a target lat/lon/date.
- Responses are normalized into common shapes defined in `@technopeace/codex-data` (e.g., `HourlySignal`, `SignalBundle`).

## Processing Pipeline
1. **Worker (future)** pulls yesterday's signals and writes canonical bundles.
2. **API** exposes `/signals` and `/reflect` endpoints that read normalized data.
3. **Front-end** renders rings and modulation pads driven by the shared types.

## Rendering
- **Visual** helpers in `@technopeace/codex-visual` project signals into rings and gradients.
- **Audio** surfaces (future) will map the same signals to synthesis parameters.

This overview will evolve alongside the ingest pipeline and renderers.
