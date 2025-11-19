// backend/helpers/storacha_fetch.js
// Fetches files from Storacha using correct gateway format

import fs from "node:fs/promises";

const [, , cid, outPath] = process.argv;

if (!cid) {
  console.error("Usage: node helpers/storacha_fetch.js <cid> [output.pdf]");
  process.exit(1);
}

async function main() {
  // Correct gateway format: {cid}.ipfs.w3s.link
  const url = `https://${cid}.ipfs.w3s.link`;

  console.error(`Fetching from: ${url}`);

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Gateway error ${res.status} for ${url}`);
    process.exit(1);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);

  if (outPath) {
    await fs.writeFile(outPath, buf);
    console.log(JSON.stringify({ ok: true, path: outPath }));
  } else {
    const b64 = buf.toString("base64");
    console.log(JSON.stringify({ content_b64: b64 }));
  }
}

main().catch((err) => {
  console.error("Storacha fetch failed:", err);
  process.exit(1);
});