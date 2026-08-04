# TechnoPeace environmental instrument architecture

## Place tonic

`derivePlaceBaseFrequency(latitude, longitude)` hashes the active place into a stable tonic. Latitude and longitude choose a mode degree, octave, and subtle micro-detune, so revisiting the same place returns the same tonal center.

## Permanent place drone

Sky Mode keeps a permanent place drone under played gestures. The drone follows the place tonic and lower infrastructure octaves, then weather, sun, moon, air, traffic, and mixer values reshape filter cutoff, gain, stereo drift, shimmer, and diffusion. Played Sky voices are separate from this drone.

## Environmental modulation

Live weather comes from `useCurrentWeatherSignal`; if weather is unavailable, clock-based sky fallback values keep the experience stable. Sky visuals and audio use sun altitude, day/night state, twilight, cloud cover, humidity, wind, rain evidence, and moon illumination without starting homepage audio.

## Sky polyphonic voices

Sky Mode sends up to four active or held pointers to the audio engine. Each played voice gets its own oscillator, filter, gain envelope, glide target, and release. X selects a place-tonic scale degree across lower and main octave access; Y controls timbre and brightness rather than replacing pitch logic. Releasing one pointer releases only that voice, while Sky Hold can retain the last four voices until cleared or mode changes.

## Chaos voice tuning

Chaos kick and bass derive from the same place tonic as Sky Mode. The bass centers one octave below the tonic with optional two-octave reinforcement. The kick uses a short downward envelope ending on a lower place-tonic octave. Hats use filtered noise with short envelopes and accent-sensitive gain. Pulse Lock gently ducks the sustained place field on kick events instead of muting the entire rhythm bus.

## Current-rain evidence rules

Rain audio is driven only by current rain evidence: current rain, current showers, or current precipitation. Daily rain accumulation is diagnostic context only and never creates current rain audio. The Rain mixer scales valid current-rain evidence; it can silence or boost valid evidence, but it does not manufacture rain when current values are zero.

## Required environment variables

The web app can run without private client-side weather keys. Optional man-made signal providers are read through existing server/API paths and should not expose secrets in client bundles.

- `VITE_API_BASE_URL` when the web app should call a deployed API instead of same-origin/default endpoints.
- Server-side provider keys used by the API deployment for traffic/air integrations, if those integrations are enabled.
