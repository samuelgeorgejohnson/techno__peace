import { createContext, useContext } from "react";

export interface ChaosState {
  x: number;
  y: number;
  pressure: number;
  tiltX: number;
  tiltY: number;
  gesture: string;
  active: boolean;
}

export const defaultChaosState: ChaosState = {
  x: 0.5,
  y: 0.5,
  pressure: 0,
  tiltX: 0.5,
  tiltY: 0.5,
  gesture: "idle",
  active: false,
};

export const ChaosContext = createContext<ChaosState>(defaultChaosState);

export const useChaos = () => useContext(ChaosContext);
