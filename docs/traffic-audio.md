# Focused traffic audio

Traffic events use only synthetic Web Audio, independent of Chaos tempo and musical pitch. Existing road-derived modulation of other layers is unchanged.

- Device-local fractional hour is read once per audio minute and refreshed on resume. It follows the listener's device timezone, not a remotely selected location. The engine payload currently has no local-hour/timezone field.
- Smoothstep interpolation wraps across midnight: 00:00 .15, 03:00 .10, 06:00 .40, 09:00 .65, 12:00 .95, 13:00 1, 15:00 .80, 18:00 .60, 22:00 .30, 23:00 .20. This is an artistic synthesis envelope.
- Valid reliable road activity is 85% live + 15% time envelope. Live = .45 density + .45 motion + .10 proximity; values are bounded. Missing, unreliable or nonfinite normalized data uses time alone and a distant .35 proximity.
- TomTom's adapter currently derives density from congestion, motion from relative speed, and sets proximity to 1; proximity is therefore a synthesis input, not a measured distance. No new live estimates are fabricated.
- Opportunity interval = 7 + 23(1-activity) + random * [3 + 22(1-activity)] seconds; pass probability = .25 + .65 activity. Skipped opportunities add silence. At peak: 7–10 seconds, 90% chance. At .10 night activity: 27.7–50.5 seconds, 31.5% chance (roughly 124 seconds mean between passes).
- Each pass lasts 1.5–5 seconds: shared noise buffer through highpass/lowpass, independently mixed quiet 42–90 Hz sine engine, approach/recede gain envelope, subtle +4% to -4% engine movement, and randomized stereo direction. Mono fallback works without StereoPanner.
- Event filters bypass the continuous bed's lowpass. Both feed the existing traffic bus and monitor gate. The bed has its own gain capped at the lesser of the old rumble level and .012 + .015 activity; it never increases to compensate for sparse events.
- At most one pass is active. Both sources stop explicitly; ended callbacks disconnect every temporary node. Stop/reset cancels active passes. Noise buffers are reused.

## Verification

Run from the repository root with a Node version supporting type stripping (as already required by the signal worker):

```sh
node --experimental-strip-types --test apps/web/src/hooks/trafficAudio.test.mjs
npm run build:web
```

The five model/graph tests were executed in the assistant's JavaScript runtime against the helper with TypeScript annotations removed. They cover smooth fallback, live authority, sparse timing, mono/stereo trajectories, and normal/early cleanup. Node tests, TypeScript build, browser listening, clipping measurements and mobile Safari checks could not be run in the connector-only session.
