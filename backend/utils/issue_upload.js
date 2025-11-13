// ESM
import fs from "node:fs/promises";
import { create } from "@storacha/client";
import * as Proof from "@storacha/client/proof";

const [, , filePath] = process.argv;
const SPACE = process.env.STORACHA_SPACE_DID;   // did:key:z6MktE7k1n8vbQK6JhKCXfUTULzgtZHY7ofCDxhYMuvi1AVo
const PROOF = process.env.STORACHA_PROOF;

if (!filePath || !SPACE || !PROOF) {
  console.error("Missing file path or STORACHA_* envs");
  process.exit(1);
}

const client = await create();
const pr = await Proof.parse(PROOF);
const space = await client.addSpace(pr);
if (space.did() !== SPACE) {
  console.error(`Space mismatch: ${space.did()} != ${SPACE}`);
  process.exit(1);
}
await client.setCurrentSpace(space.did());

const blob = new Blob([await fs.readFile(filePath)], { type: "application/pdf" });

const out = await client.uploadFile(blob);   // returns the single-file (blob) CID
const cid = out.toString();
console.log(JSON.stringify({ cid }));
