import { buildEndpoints, type Endpoint } from "./endpoints";
import { probeGetSlot, type ProbeResult } from "./probe";
import { type Sample } from "./stats";

const SAMPLE_CAP = 48;

export class RpcSession {
  endpoints: Endpoint[];
  index = 0;
  inflight = false;
  backoffUntil = 0;
  consecutive429 = 0;
  samples: Sample[] = [];
  last: ProbeResult | null = null;

  constructor(endpoints: Endpoint[] = buildEndpoints()) {
    this.endpoints = endpoints;
  }

  current(): Endpoint {
    return this.endpoints[this.index];
  }

  hop(): Endpoint {
    this.index = (this.index + 1) % this.endpoints.length;
    this.consecutive429 = 0;
    this.backoffUntil = 0;
    return this.current();
  }

  idleAllowed(): boolean {
    return !this.inflight && Date.now() >= this.backoffUntil;
  }

  async fire(reason: "poke" | "idle"): Promise<{
    result: ProbeResult | null;
    hopped: boolean;
    skipped: boolean;
  }> {
    if (this.inflight) return { result: null, hopped: false, skipped: true };
    if (reason === "idle" && Date.now() < this.backoffUntil) {
      return { result: null, hopped: false, skipped: true };
    }

    this.inflight = true;
    let hopped = false;
    let result = await probeGetSlot(this.current().url);

    if (result.status === "forbidden" || shouldHopOnError(result)) {
      this.hop();
      hopped = true;
      result = await probeGetSlot(this.current().url);
    }

    if (result.status === "rate-limit") {
      this.consecutive429 += 1;
      this.backoffUntil =
        Date.now() + Math.min(16_000, 1800 * 2 ** this.consecutive429);
    } else if (result.ok) {
      this.consecutive429 = 0;
    }

    this.samples.push({
      t: Date.now(),
      rtt: result.rttMs,
      slot: result.slot,
      status: result.status,
    });
    if (this.samples.length > SAMPLE_CAP) this.samples.shift();
    this.last = result;
    this.inflight = false;
    return { result, hopped, skipped: false };
  }
}

function shouldHopOnError(result: ProbeResult): boolean {
  if (result.status !== "error") return false;
  const msg = (result.error ?? "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("cors") ||
    msg.includes("http 5")
  );
}
