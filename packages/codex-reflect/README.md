# codex-reflect

Lightweight client and optional FastAPI router for the TechnoPeace Reflect Lite endpoint.

- `src/client.ts` – fetch helper for `/reflect` returning a mood + modulation payload.
- `reflect_api.py` – optional router that maps keywords to modulation values.
- `modulation_map.json` – tweakable defaults for tone/lfo/filter mapping.
