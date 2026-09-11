export type Endpoint = {
  name: string;
  url: string;
};

const PUBLIC: Endpoint[] = [
  { name: "publicnode", url: "https://solana-rpc.publicnode.com" },
  { name: "drpc", url: "https://solana.drpc.org" },
  { name: "ankr", url: "https://rpc.ankr.com/solana" },
  {
    name: "solana official",
    url: "https://api.mainnet-beta.solana.com",
  },
];

export function buildEndpoints(): Endpoint[] {
  const custom = import.meta.env.VITE_RPC_URL?.trim();
  if (!custom) return PUBLIC.map((e) => ({ ...e }));
  return [{ name: "VITE_RPC_URL", url: custom }, ...PUBLIC.map((e) => ({ ...e }))];
}

export function shortHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}
