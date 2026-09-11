let ctx: AudioContext | null = null;
let enabled = true;

export function setAudioEnabled(on: boolean): void {
  enabled = on;
}

export function isAudioEnabled(): boolean {
  return enabled;
}

export function unlockAudio(): void {
  if (!enabled) return;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
}

export function blip(kind: "tick" | "sour"): void {
  if (!enabled || !ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  if (kind === "tick") {
    osc.type = "sine";
    osc.frequency.setValueAtTime(680, t);
    osc.frequency.exponentialRampToValueAtTime(410, t + 0.05);
    gain.gain.setValueAtTime(0.035, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    osc.start(t);
    osc.stop(t + 0.08);
    return;
  }

  osc.type = "triangle";
  osc.frequency.setValueAtTime(188, t);
  osc.frequency.linearRampToValueAtTime(128, t + 0.14);
  gain.gain.setValueAtTime(0.045, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  osc.start(t);
  osc.stop(t + 0.22);
}
