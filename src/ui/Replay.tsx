import type { TapeFile } from "../export/tape";

type Props = {
  tape: TapeFile | null;
  playing: boolean;
  t: number;
  onToggle: () => void;
  onScrub: (t: number) => void;
  onClose: () => void;
};

export function Replay({ tape, playing, t, onToggle, onScrub, onClose }: Props) {
  if (!tape || tape.frames.length < 2) return null;
  const max = tape.frames[tape.frames.length - 1].t;

  return (
    <section className="replay" aria-label="tape replay">
      <header>
        <span>tape · {tape.frames.length} frames</span>
        <button type="button" className="linkish" onClick={onClose}>
          live
        </button>
      </header>
      <input
        type="range"
        min={0}
        max={max}
        step={16}
        value={Math.min(t, max)}
        onChange={(e) => onScrub(Number(e.target.value))}
      />
      <div className="replay-actions">
        <button type="button" onClick={onToggle}>
          {playing ? "pause" : "play"}
        </button>
        <span className="hud-k">
          {(t / 1000).toFixed(2)}s / {(max / 1000).toFixed(2)}s
        </span>
      </div>
    </section>
  );
}
