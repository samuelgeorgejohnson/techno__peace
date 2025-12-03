import { type PointerEvent, useRef, useState } from "react";

interface OnboardingOverlayProps {
  onFinish: () => void;
}

const OnboardingOverlay = ({ onFinish }: OnboardingOverlayProps) => {
  const startY = useRef<number | null>(null);
  const [dragProgress, setDragProgress] = useState(0);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    startY.current = event.clientY;
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (startY.current === null) return;
    const delta = startY.current - event.clientY;
    const threshold = window.innerHeight * 0.15;
    const progress = Math.min(Math.max(delta / threshold, 0), 1);
    setDragProgress(progress);
    if (progress >= 1) {
      onFinish();
    }
  };

  const handlePointerUp = () => {
    startY.current = null;
    setDragProgress(0);
  };

  return (
    <div className="tp-onboarding" onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
      <div className="tp-onboarding-card" onPointerDown={handlePointerDown}>
        <div className="tp-onboarding-glow" style={{ opacity: 0.3 + dragProgress * 0.6 }} />
        <div className="tp-onboarding-dot" />
        <p>Press, then slide ↑</p>
      </div>
    </div>
  );
};

export default OnboardingOverlay;
