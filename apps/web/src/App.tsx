import { computeFRP } from "@technopeace/codex-frp";
import type { HourlySignal } from "@technopeace/codex-frp";

const demoSignals: HourlySignal[] = Array.from({ length: 24 }, (_, hour) => ({
  hour,
  cloudCover: 0.3,
  windMps: 4,
  humidity: 0.55,
  moonPhase: 0.6
}));

const frp = computeFRP(
  { lat: 41.1986, lon: -74.0172, name: "Thiells" },
  demoSignals,
  14.25
);

export default function App() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>Codex FRP Debug</h1>
      <p>FRP spine output at 14.25h (demo signals)</p>
      <pre>{JSON.stringify(frp, null, 2)}</pre>
    </main>
  );
}
