import type { ImpulseKind } from "../jelly/types";
import type { ProbeStatus } from "./probe";

export type Feel = {
  kind: ImpulseKind;
  strength: number;
  damping: number;
  stiffness: number;
  sour: boolean;
  label: string;
};

export function feelFromProbe(rttMs: number, status: ProbeStatus): Feel {
  if (status === "rate-limit") {
    return {
      kind: "ugly",
      strength: 30,
      damping: 0.988,
      stiffness: 0.68,
      sour: true,
      label: "429",
    };
  }
  if (status === "forbidden" || status === "error") {
    return {
      kind: "ugly",
      strength: 26,
      damping: 0.984,
      stiffness: 0.7,
      sour: true,
      label: status === "forbidden" ? "403" : "err",
    };
  }
  if (rttMs < 80) {
    return {
      kind: "tight",
      strength: 9 + rttMs * 0.04,
      damping: 0.9,
      stiffness: 1.16,
      sour: false,
      label: "tight",
    };
  }
  if (rttMs < 180) {
    return {
      kind: "wobble",
      strength: 15 + (rttMs - 80) * 0.08,
      damping: 0.94,
      stiffness: 1,
      sour: false,
      label: "wobble",
    };
  }
  if (rttMs < 420) {
    return {
      kind: "wobble",
      strength: 22 + (rttMs - 180) * 0.06,
      damping: 0.968,
      stiffness: 0.86,
      sour: rttMs > 300,
      label: "slow",
    };
  }
  return {
    kind: "ugly",
    strength: 32 + Math.min(rttMs, 1400) * 0.01,
    damping: 0.986,
    stiffness: 0.7,
    sour: true,
    label: "slog",
  };
}
