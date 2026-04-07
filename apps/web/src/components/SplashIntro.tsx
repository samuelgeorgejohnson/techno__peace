import { useEffect, useMemo, useState } from "react";
import type { SkyState } from "./getSkyState";

type SplashPhase = "sky" | "ripples" | "dove" | "dock" | "done";

interface SplashIntroProps {
  onComplete: () => void;
  sky: SkyState;
}

const phaseSequence: SplashPhase[] = ["sky", "ripples", "dove", "dock", "done"];

function formatPhaseLabel(phase: SkyState["phase"]) {
  switch (phase) {
    case "full-day":
      return "Day sky";
    case "golden-hour":
      return "Golden hour";
    case "sunrise-sunset":
      return "Sunrise / sunset";
    case "civil-twilight":
      return "Civil twilight";
    case "nautical-twilight":
      return "Nautical twilight";
    case "astronomical-twilight":
      return "Astronomical twilight";
    default:
      return "Night sky";
  }
}

const SplashIntro = ({ onComplete, sky }: SplashIntroProps) => {
  const [phase, setPhase] = useState<SplashPhase>("sky");
  const skyLabel = useMemo(() => formatPhaseLabel(sky.phase), [sky.phase]);

  useEffect(() => {
    const timers = phaseSequence.map((value, index) =>
      window.setTimeout(() => setPhase(value), 900 * index)
    );
    const finish = window.setTimeout(onComplete, 900 * phaseSequence.length + 300);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(finish);
    };
  }, [onComplete]);

  return (
    <div className="tp-splash">
      <div
        className={`tp-splash-bg phase-${phase}`}
        style={{
          background: `radial-gradient(circle at 50% 30%, ${sky.topColor}99, transparent 42%),
          radial-gradient(circle at 22% 72%, ${sky.midColor}88, transparent 38%),
          radial-gradient(circle at 80% 62%, ${sky.horizonColor}aa, transparent 34%),
          linear-gradient(180deg, ${sky.topColor} 0%, ${sky.midColor} 52%, ${sky.horizonColor} 100%)`,
          filter: `brightness(${0.64 + sky.brightness * 0.46}) saturate(${0.75 + sky.dayness * 0.35})`,
        }}
      />
      <div className="tp-splash-content">
        <div className={`tp-ripple ripple-1 ${phase !== "sky" ? "show" : ""}`} />
        <div className={`tp-ripple ripple-2 ${phase === "ripples" || phase === "dove" ? "show" : ""}`} />
        <div className={`tp-ripple ripple-3 ${phase === "dove" || phase === "dock" || phase === "done" ? "show" : ""}`} />
        <div className={`tp-wordmark ${phase === "dove" || phase === "dock" || phase === "done" ? "show" : ""}`}>
          <div className="tp-logo" aria-hidden />
          <div>
            <p className="tp-eyebrow">{skyLabel}</p>
            <h1>TechnoPeace</h1>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SplashIntro;
