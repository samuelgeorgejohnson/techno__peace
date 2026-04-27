# Air Traffic Fetch + Adapter (Draft)

This repository now includes a typed air-traffic adapter in `@technopeace/codex-data`:

- `adaptAirTrafficResponse(...)` converts provider payloads into `AirSignal`.
- `fetchAirTrafficSignal(...)` performs runtime fetch + validation.
- `resolveAirTrafficRuntimeConfig(...)` is a minimal runtime helper.

## Runtime Environment Variables

Set these in the runtime that calls `fetchAirTrafficSignal`:

- `AIR_TRAFFIC_API_URL` (**required**)  
  Base endpoint used by `URL(...)`. Example: `https://api.your-provider.com/v1/air-traffic`
- `AIR_TRAFFIC_API_KEY` (optional, provider-dependent)  
  Used as a Bearer token in the default request.

> TODO boundary: if your provider expects `x-api-key`, OAuth, or signed headers, replace the auth header mapping in `fetchAirTrafficSignal`.

## Expected Endpoint Shape

The adapter currently expects this response shape:

```json
{
  "generatedAt": "2026-04-27T12:00:00Z",
  "aircraft": [
    {
      "id": "abcd12",
      "lat": 40.73,
      "lon": -73.93,
      "altitudeM": 10300,
      "velocityMps": 220,
      "headingDeg": 137,
      "onGround": false
    }
  ]
}
```

And sends query params in this shape:

- `lat` (number)
- `lon` (number)
- `radius_km` (number)
- `limit` (number, optional)

## Runtime Hookup Boundaries

To keep this PR reviewable and avoid fake-success behavior:

1. No fallback mock payloads are returned when network access is unavailable.
2. Missing `fetch` support or missing `AIR_TRAFFIC_API_URL` throws explicit errors.
3. Response schema mismatch throws explicit errors.

## Suggested Next Step

Wire `fetchAirTrafficSignal` into your worker/API path (likely `/signals`) and pass runtime config from your deployment secret manager rather than directly from `process.env` in shared/browser-facing code.
