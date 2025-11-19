// backend/helpers/storacha_upload.mjs
import fs from "node:fs/promises";
import { create } from "@storacha/client";
import * as Proof from "@storacha/client/proof";

const [, , filePath] = process.argv;

const SPACE = process.env.STORACHA_SPACE_DID;
const PROOF = process.env.STORACHA_PROOF;

if (!filePath) {
  console.error("Usage: node helpers/storacha_upload.mjs <file.pdf>");
  process.exit(1);
}

if (!SPACE || !PROOF) {
  console.error("Missing STORACHA_SPACE_DID or STORACHA_PROOF envs");
  process.exit(1);
}

async function main() {
  const client = await create();
  const pr = await Proof.parse(PROOF);
  const space = await client.addSpace(pr);

  if (space.did() !== SPACE) {
    console.error(`Space mismatch: ${space.did()} != ${SPACE}`);
    process.exit(1);
  }

  await client.setCurrentSpace(space.did());

  const buffer = await fs.readFile(filePath);
  const blob = new Blob([buffer], { type: "application/pdf" });

  const out = await client.uploadFile(blob);
  const cid = out.toString();

  console.log(JSON.stringify({ cid }));
}

main().catch((err) => {
  console.error("Storacha upload failed:", err);
  process.exit(1);
});
