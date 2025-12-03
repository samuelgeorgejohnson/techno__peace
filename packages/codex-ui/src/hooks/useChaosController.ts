import { useEffect, useState, RefObject } from "react";
import { ChaosState, defaultChaosState } from "../contexts/ChaosContext";

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

export const useChaosController = (targetRef: RefObject<HTMLElement>) => {
  const [state, setState] = useState<ChaosState>(defaultChaosState);

  useEffect(() => {
    const target = targetRef.current;
    if (!target || typeof window === "undefined") {
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const rect = target.getBoundingClientRect();
      const x = clamp01((event.clientX - rect.left) / rect.width);
      const y = clamp01((event.clientY - rect.top) / rect.height);

      setState((current) => ({
        ...current,
        x,
        y,
        pressure: clamp01(event.pressure || 0),
        gesture: current.active ? "drag" : "hover",
      }));
    };

    const handlePointerDown = (event: PointerEvent) => {
      const rect = target.getBoundingClientRect();
      const x = clamp01((event.clientX - rect.left) / rect.width);
      const y = clamp01((event.clientY - rect.top) / rect.height);
      setState((current) => ({
        ...current,
        x,
        y,
        active: true,
        gesture: "press",
        pressure: clamp01(event.pressure || 1),
      }));
    };

    const handlePointerUp = () => {
      setState((current) => ({ ...current, active: false, gesture: "idle", pressure: 0 }));
    };

    const handleOrientation = (event: DeviceOrientationEvent) => {
      setState((current) => ({
        ...current,
        tiltX: event.beta ? clamp01((event.beta + 180) / 360) : current.tiltX,
        tiltY: event.gamma ? clamp01((event.gamma + 90) / 180) : current.tiltY,
      }));
    };

    target.addEventListener("pointermove", handlePointerMove);
    target.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("deviceorientation", handleOrientation);

    return () => {
      target.removeEventListener("pointermove", handlePointerMove);
      target.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [targetRef]);

  return state;
};
