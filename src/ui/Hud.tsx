import { shortHost } from "../rpc/endpoints";
import type { ProbeResult } from "../rpc/probe";
import { rolling, type Sample } from "../rpc/stats";

type Props = {
  last: ProbeResult | null;
  samples: Sample[];
  endpointName: string;
  endpointUrl: string;
  waiting: boolean;
  hoppedNote: string | null;
  onHop: () => void;
};

function fmt(n: number | null, digits = 0): string {
  if (n === null || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

function tone(status: string | undefined, rtt: number | null): string {
  if (status === "rate-limit" || status === "forbidden" || status === "error") {
    return "bad";
  }
  if (rtt !== null && rtt > 300) return "warn";
  return "";
}

export function Hud({
  last,
  samples,
  endpointName,
  endpointUrl,
  waiting,
  hoppedNote,
  onHop,
}: Props) {
  const { p50, p90 } = rolling(samples);
  const rtts = samples.map((s) => s.rtt);
  const max = Math.max(80, ...rtts, last?.rttMs ?? 0);

  return (
    <aside className="hud" aria-label="rpc readout">
      <div className="hud-row">
        <span className="hud-k">rtt</span>
        <span className={`hud-v ${tone(last?.status, last?.rttMs ?? null)}`}>
          {waiting ? "…" : last ? `${fmt(last.rttMs, 0)} ms` : "—"}
          {last && last.status !== "ok" ? `  ${last.status}` : ""}
        </span>
      </div>
      <div className="hud-row">
        <span className="hud-k">p50 / p90</span>
        <span className="hud-v">
          {fmt(p50, 0)} / {fmt(p90, 0)}
        </span>
      </div>
      <div className="hud-row">
        <span className="hud-k">slot</span>
        <span className="hud-v">{last?.slot ?? "—"}</span>
      </div>
      <div className="hud-row">
        <span className="hud-k">endpoint</span>
        <span className="hud-v">
          <button type="button" className="linkish" onClick={onHop} title={endpointUrl}>
            {endpointName}
          </button>
        </span>
      </div>
      <svg className="spark" viewBox="0 0 240 28" aria-hidden="true">
        {rtts.length > 1 && (
          <polyline
            fill="none"
            stroke="rgba(214,220,226,0.7)"
            strokeWidth="1.2"
            points={rtts
              .map((v, i) => {
                const x = (i / (rtts.length - 1)) * 240;
                const y = 26 - (v / max) * 24;
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              })
              .join(" ")}
          />
        )}
      </svg>
      <div className="hud-note">
        {shortHost(endpointUrl)}
        {hoppedNote ? ` · ${hoppedNote}` : ""}
        {last?.error ? ` · ${last.error}` : ""}
        {" · click name to hop"}
      </div>
    </aside>
  );
}
