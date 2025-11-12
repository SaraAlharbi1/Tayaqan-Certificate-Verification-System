#!/usr/bin/env python3
"""
Single Certificate Verification (read-only)
Usage: python verify_certificate.py 0x<file_hash>
Env: ETH_RPC_URL / CONTRACT_ADDRESS / CERTIFICATE_ABI_PATH
"""
import json, os, sys
from pathlib import Path
from web3 import Web3
from web3.exceptions import ContractLogicError
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
    print(json.dumps({"error": f"Missing {name}"})); sys.exit(1)

def _get():
    rpc  = _need("ETH_RPC_URL", "WEB3_RPC_URL")
    addr = _need("CONTRACT_ADDRESS")
    abi  = _load_abi(_need("CERTIFICATE_ABI_PATH"))
    w3 = Web3(Web3.HTTPProvider(rpc))
    if not w3.is_connected():
        print(json.dumps({"error": f"Cannot connect to RPC {rpc}"})); sys.exit(1)
    return w3, w3.eth.contract(address=Web3.to_checksum_address(addr), abi=abi)

def main():
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: verify_certificate.py 0xFILE_HASH"})); return
    file_hash = _norm(sys.argv[1])

    try:
        _, c = _get()
        fh_bytes = Web3.to_bytes(hexstr=file_hash)
        try:
            applicantIdHash, issuedAt, revoked = c.functions.getCertificate(fh_bytes).call()
            exists = int(issuedAt) > 0
            out = {
                "exists": exists,
                "applicantIdHash": ("0x" + applicantIdHash.hex()) if exists else None,
                "issuedAt": int(issuedAt),
                "revoked": bool(revoked),
            }
        except ContractLogicError:
            out = {"exists": False, "applicantIdHash": None, "issuedAt": 0, "revoked": True}
        print(json.dumps(out, separators=(",", ":")))
    except Exception as e:
        print(json.dumps({"error": str(e)}, separators=(",", ":")))

if __name__ == "__main__":
    main()
