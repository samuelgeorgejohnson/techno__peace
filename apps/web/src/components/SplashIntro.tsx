import { useEffect, useState } from "react";

type SplashPhase = "sky" | "ripples" | "dove" | "dock" | "done";

interface SplashIntroProps {
  onComplete: () => void;
}

const phaseSequence: SplashPhase[] = ["sky", "ripples", "dove", "dock", "done"];

const SplashIntro = ({ onComplete }: SplashIntroProps) => {
  const [phase, setPhase] = useState<SplashPhase>("sky");

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
      <div className={`tp-splash-bg phase-${phase}`}></div>
      <div className="tp-splash-content">
        <div className={`tp-ripple ripple-1 ${phase !== "sky" ? "show" : ""}`} />
        <div className={`tp-ripple ripple-2 ${phase === "ripples" || phase === "dove" ? "show" : ""}`} />
        <div className={`tp-ripple ripple-3 ${phase === "dove" || phase === "dock" || phase === "done" ? "show" : ""}`} />
        <div className={`tp-wordmark ${phase === "dove" || phase === "dock" || phase === "done" ? "show" : ""}`}>
          <div className="tp-logo" aria-hidden />
          <div>
            <p className="tp-eyebrow">Sky Mode</p>
            <h1>TechnoPeace</h1>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SplashIntro;
