import { useEffect, useState } from "react";
import SplashIntro from "./components/SplashIntro";
import OnboardingOverlay from "./components/OnboardingOverlay";
import ChaosPadCard from "./components/ChaosPad";

const ONBOARD_KEY = "tp_onboard";

const App = () => {
  const [splashDone, setSplashDone] = useState(false);
  const [needsOnboard, setNeedsOnboard] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(ONBOARD_KEY);
    setNeedsOnboard(stored !== "1");
  }, []);

  const handleOnboardingFinish = () => {
    localStorage.setItem(ONBOARD_KEY, "1");
    setNeedsOnboard(false);
  };

  if (!splashDone) {
    return <SplashIntro onComplete={() => setSplashDone(true)} />;
  }

  return (
    <div className="tp-app-shell">
      {needsOnboard && <OnboardingOverlay onFinish={handleOnboardingFinish} />}
      <header className="tp-header">
        <div>
          <p className="tp-eyebrow">Sky Mode</p>
          <h1>TechnoPeace</h1>
          <p className="tp-subtitle">
            Environmental signals, playful chaos modulation, and reflective tones.
          </p>
        </div>
        <div className="tp-pill">Prototype</div>
      </header>
      <main className="tp-grid">
        <section className="tp-card">
          <div className="tp-card-head">
            <div>
              <p className="tp-eyebrow">ChaosPad</p>
              <h2>Sky ripples</h2>
              <p className="tp-subtitle">Press, slide, and tilt to stir the ether.</p>
            </div>
          </div>
          <div className="tp-card-body">
            <ChaosPadCard />
          </div>
        </section>
        <section className="tp-card tp-card-secondary">
          <div className="tp-card-head">
            <p className="tp-eyebrow">Reflect</p>
            <h2>Feeling check-in</h2>
          </div>
          <p className="tp-subtitle">
            The Reflect Lite endpoint will map text to modulation soon. For now, vibe with the
            ChaosPad while the signals stream in.
          </p>
        </section>
      </main>
    </div>
  );
};

export default App;
