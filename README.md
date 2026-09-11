# rpcjelly

Poke the jelly. It asks Solana for the current slot. The round-trip time is the wobble.

Fast RPC → a tight shiver. Slow or 429 → a big ugly slosh. That’s the whole product.

Live: https://robertkodes.github.io/rpcjelly/

## Feel

1. Drag the blob. Springs stretch immediately.
2. A `getSlot` fires (also every ~1.5s if you leave it alone).
3. When the response lands, the mesh gets an impulse scaled by RTT.
4. Corner HUD: last ms, rolling p50/p90, endpoint, slot.

Official `api.mainnet-beta.solana.com` often 403s browser Origins. We start on PublicNode, then OnFinality (often 429 — that's the sour wobble), then official. Click the endpoint name to hop. Pin your own with `VITE_RPC_URL`.

No wallet. No trade. Public RPC only. 429s back off.

## Export

The last ~8s of motion sits in a ring buffer. **save tape** dumps JSON you can scrub in-page (or **load tape** later). **film 6s** tries a WebM via `MediaRecorder` if the browser plays along.

## Dev

```bash
npm i
npm run dev
```

GitHub Pages uses `base: '/rpcjelly/'`, so the app lives at `/rpcjelly/` in both dev and preview.

```bash
npm run build
npm run preview
```

## Smoke

- poke → request in flight (tiny wait dot) → impulse
- ~110ms stays a tight blob; ~250ms+ squash; 429 goes yellow-green and sloshes
- save tape, scrub it (JSON). film 6s if the browser has MediaRecorder

GitHub Pages: branch `gh-pages`, folder `/`. Live: https://robertkodes.github.io/rpcjelly/
