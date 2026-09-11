export type Particle = {
  x: number;
  y: number;
  px: number;
  py: number;
  restX: number;
  restY: number;
  ring: number;
  invMass: number;
};

export type Spring = {
  a: number;
  b: number;
  rest: number;
  k: number;
};

export type Grab = {
  x: number;
  y: number;
};

export type ImpulseKind = "tight" | "wobble" | "ugly";

export type Jelly = {
  particles: Particle[];
  springs: Spring[];
  surface: number[];
  inner: number[];
  cx: number;
  cy: number;
  radius: number;
  grab: Grab | null;
  damping: number;
  stiffnessScale: number;
  waiting: boolean;
};
