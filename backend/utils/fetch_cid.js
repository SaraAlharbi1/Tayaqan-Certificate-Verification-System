#!/usr/bin/env node
/**
 * Fetch encrypted bytes from an IPFS gateway and print base64 JSON:
 *   {"bytes_b64":"..."}
 *
 * Usage:
 *   node utils/fetch_cid.js <CID-or-full-URL>
 *
 * Env (optional):
 *   GATEWAY_BASE   e.g. https://storacha.link/ipfs/  (must include trailing /)
 */
const input = process.argv[2];
if (!input) {
  console.error("Usage: node utils/fetch_cid.js <CID-or-full-URL>");
  process.exit(2);
}

const BASE = process.env.GATEWAY_BASE || "https://storacha.link/ipfs/";
const url = input.startsWith("http") ? input : `${BASE}${input}`;

async function main() {
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Gateway fetch failed ${res.status}: ${txt}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  process.stdout.write(JSON.stringify({ bytes_b64: buf.toString("base64") }));
}

main().catch(e => {
  console.error(e.message || String(e));
  process.exit(1);
});
