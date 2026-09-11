import type { ImpulseKind, Jelly, Particle, Spring } from "./types";

const RING_DEF = [
  { t: 0, n: 1 },
  { t: 0.3, n: 8 },
  { t: 0.54, n: 14 },
  { t: 0.76, n: 20 },
  { t: 1, n: 28 },
] as const;

function hypot(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy);
}

export function createJelly(): Jelly {
  return {
    particles: [],
    springs: [],
    surface: [],
    inner: [],
    cx: 0,
    cy: 0,
    radius: 120,
    grab: null,
    damping: 0.935,
    stiffnessScale: 1,
    waiting: false,
    restArea: 0,
  };
}

export function layoutJelly(
  jelly: Jelly,
  width: number,
  height: number,
  hard = false,
): void {
  const cx = width * 0.5;
  const cy = height * 0.52;
  const radius = Math.min(width, height) * 0.27;
  const first = jelly.particles.length === 0;
  jelly.cx = cx;
  jelly.cy = cy;
  jelly.radius = radius;

  if (first) {
    buildMesh(jelly, cx, cy, radius);
    return;
  }

  let i = 0;
  for (const ring of RING_DEF) {
    for (let k = 0; k < ring.n; k++) {
      const ang = ring.n === 1 ? 0 : (k / ring.n) * Math.PI * 2 - Math.PI / 2;
      const lump = ring.t === 0 ? 1 : 1 + 0.03 * Math.sin(ang * 3 + ring.t * 4);
      const restX = cx + Math.cos(ang) * radius * ring.t * lump;
      const restY = cy + Math.sin(ang) * radius * ring.t * lump;
      const p = jelly.particles[i];
      const dx = restX - p.restX;
      const dy = restY - p.restY;
      p.restX = restX;
      p.restY = restY;
      if (hard) {
        p.x = restX;
        p.y = restY;
        p.px = restX;
        p.py = restY;
      } else {
        p.x += dx;
        p.y += dy;
        p.px += dx;
        p.py += dy;
      }
      i += 1;
    }
  }

  for (const s of jelly.springs) {
    const a = jelly.particles[s.a];
    const b = jelly.particles[s.b];
    s.rest = hypot(b.restX - a.restX, b.restY - a.restY);
  }
  jelly.restArea = polygonArea(jelly, true);
}

function buildMesh(jelly: Jelly, cx: number, cy: number, radius: number): void {
  const particles: Particle[] = [];
  const rings: number[][] = [];

  for (const ring of RING_DEF) {
    const ids: number[] = [];
    for (let k = 0; k < ring.n; k++) {
      const ang = ring.n === 1 ? 0 : (k / ring.n) * Math.PI * 2 - Math.PI / 2;
      const lump = ring.t === 0 ? 1 : 1 + 0.03 * Math.sin(ang * 3 + ring.t * 4);
      const x = cx + Math.cos(ang) * radius * ring.t * lump;
      const y = cy + Math.sin(ang) * radius * ring.t * lump;
      ids.push(particles.length);
      particles.push({
        x,
        y,
        px: x,
        py: y,
        restX: x,
        restY: y,
        ring: rings.length,
        invMass: ring.t === 0 ? 0.55 : 1,
      });
    }
    rings.push(ids);
  }

  const springs: Spring[] = [];
  const addSpring = (a: number, b: number, k: number) => {
    if (a === b) return;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key)) return;
    seen.add(key);
    const pa = particles[a];
    const pb = particles[b];
    springs.push({
      a,
      b,
      rest: hypot(pb.x - pa.x, pb.y - pa.y),
      k,
    });
  };
  const seen = new Set<string>();

  for (const ids of rings) {
    if (ids.length < 2) continue;
    const ringIndex = particles[ids[0]].ring;
    const k = ringIndex === rings.length - 1 ? 0.36 : 0.5;
    for (let i = 0; i < ids.length; i++) {
      addSpring(ids[i], ids[(i + 1) % ids.length], k);
      if (ids.length >= 8) addSpring(ids[i], ids[(i + 2) % ids.length], k * 0.55);
    }
  }

  for (let r = 1; r < rings.length; r++) {
    const outer = rings[r];
    const inner = rings[r - 1];
    for (let i = 0; i < outer.length; i++) {
      const p = particles[outer[i]];
      let best = inner[0];
      let bestD = Infinity;
      let second = inner[0];
      let secondD = Infinity;
      for (const id of inner) {
        const q = particles[id];
        const d = hypot(p.x - q.x, p.y - q.y);
        if (d < bestD) {
          second = best;
          secondD = bestD;
          best = id;
          bestD = d;
        } else if (d < secondD) {
          second = id;
          secondD = d;
        }
      }
      addSpring(outer[i], best, 0.44);
      if (inner.length > 1) addSpring(outer[i], second, 0.24);
    }
  }

  jelly.particles = particles;
  jelly.springs = springs;
  jelly.surface = rings[rings.length - 1];
  jelly.inner = rings[1];
  jelly.restArea = polygonArea(jelly, true);
}

export function setGrab(jelly: Jelly, x: number, y: number): void {
  jelly.grab = { x, y };
}

export function clearGrab(jelly: Jelly): void {
  jelly.grab = null;
}

export function applyImpulse(
  jelly: Jelly,
  kind: ImpulseKind,
  strength: number,
): void {
  const amp = (strength / 28) * jelly.radius * 0.42;
  const { x: mx, y: my } = com(jelly);
  const ang = Math.random() * Math.PI * 2;
  const ax = Math.cos(ang);
  const ay = Math.sin(ang);
  const tx = -ay;
  const ty = ax;
  let squash = 0.15;
  let bulge = 0.12;
  let kick = amp * 0.22;
  let jitter = amp * 0.04;
  if (kind === "tight") {
    squash = 0.08;
    bulge = 0.06;
    kick = amp * 0.12;
    jitter = amp * 0.015;
  } else if (kind === "ugly") {
    squash = 0.24;
    bulge = 0.2;
    kick = amp * 0.38;
    jitter = amp * 0.12;
  }
  for (const p of jelly.particles) {
    if (p.ring === 0) continue;
    const dx = p.x - mx;
    const dy = p.y - my;
    const along = dx * ax + dy * ay;
    const across = dx * tx + dy * ty;
    p.x += ax * along * -squash + tx * across * bulge + ax * kick;
    p.y += ay * along * -squash + ty * across * bulge + ay * kick;
    p.x += (Math.random() - 0.5) * jitter;
    p.y += (Math.random() - 0.5) * jitter;
  }
}

export function stepJelly(jelly: Jelly, dt: number): void {
  const steps = Math.min(dt, 1 / 30) > 1 / 50 ? 2 : 1;
  for (let i = 0; i < steps; i++) integrate(jelly);
}

function integrate(jelly: Jelly): void {
  const damp = jelly.damping;
  const particles = jelly.particles;

  for (const p of particles) {
    const vx = (p.x - p.px) * damp;
    const vy = (p.y - p.py) * damp;
    p.px = p.x;
    p.py = p.y;
    p.x += vx;
    p.y += vy;
    // soft home spring so the blob remembers its rest shape
    const home = jelly.grab ? 0.004 : 0.01;
    p.x += (p.restX - p.x) * home * p.invMass;
    p.y += (p.restY - p.y) * home * p.invMass;
  }

  if (jelly.grab) {
    const R = jelly.radius * 0.5;
    const gx = jelly.grab.x;
    const gy = jelly.grab.y;
    for (const p of particles) {
      const dx = gx - p.x;
      const dy = gy - p.y;
      const d = hypot(dx, dy);
      if (d > R) continue;
      const w = (1 - d / R) ** 2 * (p.ring >= 3 ? 0.62 : 0.28);
      p.x += dx * w;
      p.y += dy * w;
      p.px += (p.x - p.px) * 0.22;
      p.py += (p.y - p.py) * 0.22;
    }
  }

  const iters = jelly.grab ? 3 : 5;
  const kScale = jelly.stiffnessScale;
  for (let n = 0; n < iters; n++) {
    for (const s of jelly.springs) {
      const a = particles[s.a];
      const b = particles[s.b];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = hypot(dx, dy) || 0.0001;
      const inv = (dist - s.rest) / dist;
      const stiffness = s.k * kScale * 0.55;
      const w = a.invMass + b.invMass;
      const oa = (inv * stiffness * a.invMass) / w;
      const ob = (inv * stiffness * b.invMass) / w;
      a.x += dx * oa;
      a.y += dy * oa;
      b.x -= dx * ob;
      b.y -= dy * ob;
    }
    applyPressure(jelly);
  }

  // keep the mass on screen after a big slosh
  const c = com(jelly);
  const pullX = (jelly.cx - c.x) * (jelly.grab ? 0.004 : 0.012);
  const pullY = (jelly.cy - c.y) * (jelly.grab ? 0.004 : 0.012);
  for (const p of particles) {
    p.x += pullX;
    p.y += pullY;
  }
}

function polygonArea(jelly: Jelly, rest: boolean): number {
  const ids = jelly.surface;
  const n = ids.length;
  if (n < 3) return 0;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const a = jelly.particles[ids[i]];
    const b = jelly.particles[ids[(i + 1) % n]];
    if (rest) acc += a.restX * b.restY - b.restX * a.restY;
    else acc += a.x * b.y - b.x * a.y;
  }
  return acc * 0.5;
}

function applyPressure(jelly: Jelly): void {
  const rest = jelly.restArea || polygonArea(jelly, true);
  if (rest <= 1) return;
  const area = polygonArea(jelly, false);
  const err = (rest - area) / rest;
  const push = err * jelly.radius * 0.085;
  const c = com(jelly);
  for (const id of jelly.surface) {
    const p = jelly.particles[id];
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const len = hypot(dx, dy) || 1;
    p.x += (dx / len) * push;
    p.y += (dy / len) * push;
  }
}

export function com(jelly: Jelly): { x: number; y: number } {
  let x = 0;
  let y = 0;
  const n = jelly.particles.length || 1;
  for (const p of jelly.particles) {
    x += p.x;
    y += p.y;
  }
  return { x: x / n, y: y / n };
}

export function snapshotPoints(jelly: Jelly): number[] {
  const out = new Array<number>(jelly.particles.length * 2);
  let i = 0;
  for (const p of jelly.particles) {
    out[i++] = p.x;
    out[i++] = p.y;
  }
  return out;
}

export function applySnapshot(jelly: Jelly, pts: number[]): void {
  const n = Math.min(jelly.particles.length, pts.length / 2);
  for (let i = 0; i < n; i++) {
    const p = jelly.particles[i];
    p.x = pts[i * 2];
    p.y = pts[i * 2 + 1];
    p.px = p.x;
    p.py = p.y;
  }
}
