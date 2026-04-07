# TechnoPeace Monorepo

TechnoPeace is an ambient web instrument that turns live environmental signals into responsive sound and sky visuals. The current experience focuses on **Sky Mode**: a place-tuning ritual that opens into a weather-reactive drone surface with a channel mixer for natural and urban textures.

## What’s New in This Version
- **Refined opening ritual** with staged splash phases (`sky → ripples → dove → dock`) before entering the instrument.
- **Richer live weather ingestion** from Open-Meteo, including humidity and precipitation fields.
- **Expanded audio modulation** using humidity, rain, showers, cloud cover, wind, solar altitude, moon phase, and temperature.
- **Rain-responsive micro-events** (droplet ticks) layered into the synthesized sound bed.
- **On-screen channel mixer** split into Weather and Man-made pages for shaping the scene.

## Monorepo Structure
- `apps/web` — Vite + React front-end for Sky Mode and interaction flow.
- `apps/api` — FastAPI service surface for signal and reflection endpoints.
- `packages/codex-*` — Shared libraries for UI, data types, map/location, reflection, and render helpers.
- `docs/` — Architecture notes and implementation overviews.

## Getting Started
```bash
# run web app
npm run dev:web

# run FastAPI (development)
npm run dev:api
```

## Runtime Notes
- Sky Mode requests user location when available and falls back to default coordinates when unavailable.
- Weather polling currently uses Open-Meteo (`forecast_days=1`) with current + daily fields.
- Audio initializes on user interaction and transitions to a steady center-pressure drone before free pointer play.

## Environment
Copy `.env.example` to `.env` and fill required keys for your setup:
- Weather / astronomy credentials (if needed for local API flows)
- Default latitude/longitude/timezone values
- Optional render or storage settings

## Roadmap Focus
- Continue stabilizing the Sky Mode interaction and atmosphere controls.
- Connect mixer channels to deeper synthesis/sample routing.
- Expand `/signals` and `/reflect` integration between API and web.
