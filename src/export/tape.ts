import type { Feel } from "../rpc/feel";

export type TapeFrame = {
  t: number;
  pts: number[];
  rtt: number | null;
  slot: number | null;
  feel: string;
  sour: boolean;
};

export type TapeFile = {
  v: 1;
  app: "rpcjelly";
  recordedAt: string;
  endpoint: string;
  frames: TapeFrame[];
  samples: { t: number; rtt: number; slot: number | null; status: string }[];
};

const WINDOW_MS = 8000;
const FRAME_MS = 1000 / 30;

export class MotionTape {
  frames: TapeFrame[] = [];
  private lastPush = 0;

  push(
    now: number,
    pts: number[],
    rtt: number | null,
    slot: number | null,
    feel: Feel | null,
  ): void {
    if (now - this.lastPush < FRAME_MS) return;
    this.lastPush = now;
    this.frames.push({
      t: now,
      pts,
      rtt,
      slot,
      feel: feel?.label ?? "idle",
      sour: feel?.sour ?? false,
    });
    const cut = now - WINDOW_MS;
    while (this.frames.length && this.frames[0].t < cut) this.frames.shift();
  }

  toFile(
    endpoint: string,
    samples: TapeFile["samples"],
  ): TapeFile {
    const t0 = this.frames[0]?.t ?? 0;
    return {
      v: 1,
      app: "rpcjelly",
      recordedAt: new Date().toISOString(),
      endpoint,
      frames: this.frames.map((f) => ({ ...f, t: f.t - t0 })),
      samples,
    };
  }

  duration(): number {
    if (this.frames.length < 2) return 0;
    return this.frames[this.frames.length - 1].t - this.frames[0].t;
  }
}

export function lerpFrames(
  a: TapeFrame,
  b: TapeFrame,
  u: number,
): number[] {
  const n = Math.min(a.pts.length, b.pts.length);
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    out[i] = a.pts[i] + (b.pts[i] - a.pts[i]) * u;
  }
  return out;
}

export function frameAt(frames: TapeFrame[], t: number): TapeFrame | null {
  if (!frames.length) return null;
  if (t <= frames[0].t) return frames[0];
  if (t >= frames[frames.length - 1].t) return frames[frames.length - 1];
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = frames[lo];
  const b = frames[hi];
  const span = b.t - a.t || 1;
  const u = (t - a.t) / span;
  return {
    t,
    pts: lerpFrames(a, b, u),
    rtt: u < 0.5 ? a.rtt : b.rtt,
    slot: u < 0.5 ? a.slot : b.slot,
    feel: u < 0.5 ? a.feel : b.feel,
    sour: u < 0.5 ? a.sour : b.sour,
  };
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  clickDownload(filename, blob);
}

export function clickDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function recordWebm(
  canvas: HTMLCanvasElement,
  ms: number,
): Promise<Blob> {
  const stream = canvas.captureStream(30);
  const mime = pickMime();
  if (!mime) throw new Error("no MediaRecorder video type");
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_400_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  return new Promise((resolve, reject) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: mime }));
    rec.onerror = () => reject(new Error("recorder failed"));
    rec.start();
    window.setTimeout(() => {
      if (rec.state !== "inactive") rec.stop();
    }, ms);
  });
}

export function webmSupported(): boolean {
  return pickMime() !== null;
}

function pickMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const types = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}
