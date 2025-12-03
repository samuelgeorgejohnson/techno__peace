# TechnoPeace Monorepo

Ambient web experience that turns environmental signals and personal reflections into sound and light.

## Structure
- `apps/web` – Vite + React "Sky Mode" (splash, ChaosPad, later map/avatar)
- `apps/api` – FastAPI backend (signals, reflect-lite)
- `packages/codex-*` – shared types, UI, visual helpers, map, reflect client
- `docs/` – design notes and pipeline overviews

## Getting Started
```bash
# run web app
npm run dev:web

# run FastAPI (development)
npm run dev:api
```

## Environment
Copy `.env.example` to `.env` and fill any required keys:
- OpenWeather and astronomy API credentials
- Default lat/lon/timezone for the demo
- Optional render and storage settings

## Contributing Notes
- Workspaces are managed with npm.
- Base TypeScript config lives in `tsconfig.base.json` with path aliases for shared packages.
- Turbo is configured for future caching/CI use.

## Roadmap
- Stabilize splash + ChaosPad experience.
- Flesh out signal ingest + visualization helpers.
- Light up `/signals` and `/reflect` endpoints and connect to the UI.
