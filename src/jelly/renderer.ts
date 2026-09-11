import { com } from "./physics";
import type { Jelly } from "./types";

export type JellyTint = {
  hue: number;
  sat: number;
  lit: number;
  sour: boolean;
};

export function tintFromFeel(
  rttMs: number | null,
  sour: boolean,
  waiting: boolean,
): JellyTint {
  if (sour) return { hue: 72, sat: 58, lit: 50, sour: true };
  const ms = rttMs ?? 140;
  const t = Math.min(1, Math.max(0, (ms - 50) / 380));
  const hue = 168 - t * 86;
  const sat = 48 + t * 16;
  const lit = waiting ? 58 : 52;
  return { hue, sat, lit, sour: false };
}

function pathFrom(ctx: CanvasRenderingContext2D, jelly: Jelly, ids: number[]): void {
  const pts = ids.map((id) => jelly.particles[id]);
  const n = pts.length;
  if (n < 3) return;
  const mid = (i: number) => {
    const a = pts[i % n];
    const b = pts[(i + 1) % n];
    return { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
  };
  const m0 = mid(0);
  ctx.moveTo(m0.x, m0.y);
  for (let i = 0; i < n; i++) {
    const p = pts[(i + 1) % n];
    const m = mid(i + 1);
    ctx.quadraticCurveTo(p.x, p.y, m.x, m.y);
  }
  ctx.closePath();
}

export function drawJelly(
  ctx: CanvasRenderingContext2D,
  jelly: Jelly,
  tint: JellyTint,
  dpr: number,
): void {
  const { width, height } = ctx.canvas;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width / dpr, height / dpr);

  const c = com(jelly);
  const fill = `hsla(${tint.hue}, ${tint.sat}%, ${tint.lit}%, 0.82)`;
  const deep = `hsla(${tint.hue}, ${tint.sat + 6}%, ${Math.max(22, tint.lit - 18)}%, 0.9)`;
  const glow = tint.sour
    ? "hsla(78, 70%, 48%, 0.18)"
    : `hsla(${tint.hue}, 70%, 60%, 0.18)`;

  ctx.save();
  ctx.filter = `blur(${Math.max(8, jelly.radius * 0.07)}px)`;
  ctx.fillStyle = glow;
  ctx.beginPath();
  pathFrom(ctx, jelly, jelly.surface);
  ctx.fill();
  ctx.restore();

  const grad = ctx.createRadialGradient(
    c.x - jelly.radius * 0.18,
    c.y - jelly.radius * 0.22,
    jelly.radius * 0.05,
    c.x,
    c.y + jelly.radius * 0.08,
    jelly.radius * 1.02,
  );
  grad.addColorStop(0, `hsla(${tint.hue}, ${tint.sat - 6}%, ${tint.lit + 16}%, 0.92)`);
  grad.addColorStop(0.55, fill);
  grad.addColorStop(1, deep);

  ctx.beginPath();
  pathFrom(ctx, jelly, jelly.surface);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = `hsla(${tint.hue}, 35%, 88%, 0.45)`;
  ctx.stroke();

  ctx.beginPath();
  pathFrom(ctx, jelly, jelly.inner);
  ctx.strokeStyle = `hsla(${tint.hue}, 40%, 80%, 0.22)`;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.strokeStyle = `hsla(${tint.hue}, 30%, 80%, 0.12)`;
  ctx.lineWidth = 0.8;
  const surface = jelly.surface;
  const inner = jelly.inner;
  const spokes = Math.min(surface.length, 10);
  for (let i = 0; i < spokes; i++) {
    const a = jelly.particles[surface[Math.floor((i * surface.length) / spokes)]];
    const b = jelly.particles[inner[Math.floor((i * inner.length) / spokes)]];
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  if (jelly.inner.length) {
    ctx.beginPath();
    pathFrom(ctx, jelly, jelly.inner);
    ctx.fillStyle = `hsla(${tint.hue}, 50%, 78%, 0.12)`;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.ellipse(
    c.x - jelly.radius * 0.18,
    c.y - jelly.radius * 0.22,
    jelly.radius * 0.16,
    jelly.radius * 0.09,
    -0.45,
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = tint.sour ? "rgba(240, 230, 120, 0.16)" : "rgba(255,255,255,0.16)";
  ctx.fill();

  if (jelly.waiting) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fill();
  }
}
