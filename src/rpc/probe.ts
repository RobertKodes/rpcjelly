export type ProbeStatus = "ok" | "rate-limit" | "forbidden" | "error";

export type ProbeResult = {
  ok: boolean;
  rttMs: number;
  slot: number | null;
  url: string;
  status: ProbeStatus;
  error?: string;
};

type RpcBody = {
  result?: number;
  error?: { message?: string; code?: number };
};

export async function probeGetSlot(url: string): Promise<ProbeResult> {
  const t0 = performance.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSlot" }),
    });
    const rttMs = performance.now() - t0;
    if (res.status === 429) {
      return { ok: false, rttMs, slot: null, url, status: "rate-limit" };
    }
    if (res.status === 403) {
      return {
        ok: false,
        rttMs,
        slot: null,
        url,
        status: "forbidden",
        error: "403 Origin blocked",
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        rttMs,
        slot: null,
        url,
        status: "error",
        error: `HTTP ${res.status}`,
      };
    }
    const json = (await res.json()) as RpcBody;
    if (json.error) {
      const msg = json.error.message ?? "rpc error";
      const rate =
        json.error.code === -32029 || /too many|rate.?limit/i.test(msg);
      return {
        ok: false,
        rttMs,
        slot: null,
        url,
        status: rate ? "rate-limit" : "error",
        error: msg,
      };
    }
    const slot = typeof json.result === "number" ? json.result : null;
    return { ok: true, rttMs, slot, url, status: "ok" };
  } catch (err) {
    return {
      ok: false,
      rttMs: performance.now() - t0,
      slot: null,
      url,
      status: "error",
      error: err instanceof Error ? err.message : "fetch failed",
    };
  }
}
