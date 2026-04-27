# Air Traffic Fetch + Adapter

This repository includes a typed air-traffic adapter in `@technopeace/codex-data` and a narrow server integration in `apps/api`.

- `adaptAirTrafficResponse(...)` converts provider payloads into `AirSignal`.
- `fetchAirTrafficSignal(...)` performs runtime fetch + validation.
- `resolveAirTrafficRuntimeConfig(...)` resolves server runtime config.
- `GET /signals` (FastAPI) now invokes the adapter through a small Node worker (`apps/api/airTrafficSignalWorker.ts`).

## Server Runtime Environment Variables

The server-owned `/signals` path now sets adapter runtime entirely on the server:

- Worker (`apps/api/airTrafficSignalWorker.ts`) resolves provider config via `resolveAirTrafficRuntimeConfig()` from `process.env`:
  - `AIR_TRAFFIC_API_URL` (**required**)
  - `AIR_TRAFFIC_API_KEY` (optional, provider-dependent)
- API layer (`apps/api/main.py`) sets request defaults before calling worker:
  - `AIR_TRAFFIC_RADIUS_KM` (optional, defaults to `80`)
  - `AIR_TRAFFIC_TIMEOUT_MS` (optional, defaults to `8000`)
  - `AIR_TRAFFIC_LIMIT` (optional, defaults to `100`)

No browser-facing code receives provider credentials, and there is no direct browser fetch to the air-traffic provider.

## `/signals` Response Shape (current narrow scope)

Current server scope returns only the first man-made source channel (`manMade.air`):

```json
{
  "coordinates": {
    "lat": 40.73,
    "lon": -73.93
  },
  "manMade": {
    "air": {
      "count": 4,
      "nearestDistanceKm": 12.7,
      "avgAltitudeM": 10300,
      "avgVelocityMps": 220,
      "headingSpread": 137,
      "normalized": {
        "density": 0.13,
        "proximity": 0.84,
        "motion": 0.85,
        "tension": 0.76,
        "brightness": 0.82,
        "pulseRate": 0.84
      }
    }
  },
  "meta": {
    "airStatus": "live",
    "airConfig": {
      "radiusKm": 80,
      "timeoutMs": 8000,
      "limit": 100
    }
  }
}
```

When config is missing or provider calls fail, `manMade.air` is `null`, `meta.airStatus` is `"unavailable"`, and `meta.airError` is populated. `meta.airConfig` still reports the server-side radius/timeout/limit used for the attempted fetch.

## Failure Behavior (explicit, no fake success)

- Missing `AIR_TRAFFIC_API_URL` results in adapter error and `manMade.air: null`.
- Provider/network/schema failures result in `manMade.air: null`.
- API still responds successfully with explicit unavailable metadata, rather than crashing.

## Next Step

Consume `manMade.air` in web/audio signal pipelines in a follow-up PR (UI/audio work intentionally deferred in this server-only integration).
