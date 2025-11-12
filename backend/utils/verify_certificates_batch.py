#!/usr/bin/env python3
"""
Batch Certificate Verification (read-only)
Usage: python verify_certificates_batch.py 0x<hash1> 0x<hash2> ...
Env: ETH_RPC_URL / CONTRACT_ADDRESS / CERTIFICATE_ABI_PATH
"""
import json, os, sys
from pathlib import Path
from web3 import Web3
from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_ROOT / ".env")

def _norm(h: str) -> str:
    h = (h or "").strip().lower()
    return h if h.startswith("0x") else "0x" + h

def _load_abi(path: str):
    p = Path(path)
    if not p.is_absolute():
        p = (BACKEND_ROOT / path).resolve()
    with p.open("r", encoding="utf-8") as f:
        data = json.load(f)
    return data["abi"] if isinstance(data, dict) and "abi" in data else data

def _need(name, *aliases):
    for k in (name, *aliases):
        v = os.getenv(k)
        if v: return v
    raise RuntimeError(f"missing env: {name} (aliases: {aliases})")

def _contract():
    rpc  = _need("ETH_RPC_URL", "WEB3_RPC_URL")
    addr = _need("CONTRACT_ADDRESS")
    abi  = _load_abi(_need("CERTIFICATE_ABI_PATH"))
    w3 = Web3(Web3.HTTPProvider(rpc))
    if not w3.is_connected():
        raise RuntimeError(f"Cannot connect to RPC {rpc}")
    return w3.eth.contract(address=Web3.to_checksum_address(addr), abi=abi)

def main():
    file_hashes = [_norm(h) for h in sys.argv[1:] if h]
    if not file_hashes:
        print("[]"); return

    try:
        c = _contract()
        fh_bytes = [Web3.to_bytes(hexstr=h) for h in file_hashes]
        results = c.functions.getCertificatesBatch(fh_bytes).call()
        out = []
        for i, (applicantIdHash, issuedAt, revoked) in enumerate(results):
            out.append({
                "fileHash": file_hashes[i],
                "exists": int(issuedAt) > 0,
                "revoked": bool(revoked),
            })
        print(json.dumps(out, separators=(",", ":")))
    except Exception as e:
        print(json.dumps([
            {"fileHash": h, "exists": False, "revoked": True, "error": str(e)}
            for h in file_hashes
        ], separators=(",", ":")))

if __name__ == "__main__":
    main()
