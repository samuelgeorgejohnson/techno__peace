# Air Traffic Fetch + Adapter

This repository includes a typed air-traffic adapter in `@technopeace/codex-data` and a narrow server integration in `apps/api`.

- `adaptAirTrafficResponse(...)` converts provider payloads into `AirSignal`.
- `fetchAirTrafficSignal(...)` performs runtime fetch + validation.
- `resolveAirTrafficRuntimeConfig(...)` resolves server runtime config.
- `GET /signals` (FastAPI) now invokes the adapter through a small Node worker (`apps/api/airTrafficSignalWorker.ts`).

## Server Runtime Environment Variables

The server-side worker reads these values via `resolveAirTrafficRuntimeConfig()` from `process.env`:

- `AIR_TRAFFIC_API_URL` (**required**)  
  Base endpoint used by `URL(...)`. Example: `https://api.your-provider.com/v1/air-traffic`
- `AIR_TRAFFIC_API_KEY` (optional, provider-dependent)  
  Used as a Bearer token in the default request.

These are not exposed to browser code; they are consumed only by the API's server-owned worker path.

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

When config is missing or provider calls fail, `manMade.air` is `null`, `meta.airStatus` is `"unavailable"`, and `meta.airError` is populated.

## Failure Behavior (explicit, no fake success)

- Missing `AIR_TRAFFIC_API_URL` results in adapter error and `manMade.air: null`.
- Provider/network/schema failures result in `manMade.air: null`.
- API still responds successfully with explicit unavailable metadata, rather than crashing.

## Next Step

Consume `manMade.air` in web/audio signal pipelines in a follow-up PR (UI/audio work intentionally deferred in this server-only integration).
