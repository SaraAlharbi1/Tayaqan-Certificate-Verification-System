#!/usr/bin/env node
/**
 * Fetch encrypted bytes of a CID from an IPFS gateway and return base64.
 * Prints: {"bytes_b64":"..."}
 *
 * Usage: node fetch_cid.js <cid>
 * Optional env: GATEWAY_BASE (default https://w3s.link/ipfs/)
 */
const cid = process.argv[2];
if (!cid) {
  console.error("Usage: node fetch_cid.js <cid>");
  process.exit(2);
}
const GATEWAY_BASE = process.env.GATEWAY_BASE || "https://w3s.link/ipfs/";

async function main() {
  const url = `${GATEWAY_BASE}${cid}`;
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Gateway fetch failed ${res.status}: ${txt}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  // return as base64 in JSON (consistent with other helpers)
  process.stdout.write(JSON.stringify({ bytes_b64: buf.toString("base64") }));
}
main().catch((e) => {
  console.error(e.message || String(e));
  process.exit(1);
});