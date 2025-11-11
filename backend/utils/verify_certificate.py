#!/usr/bin/env python3
"""
Verify one certificate via contract.getCertificate(fileHash).
OUT: {exists, applicantIdHash, issuedAt, revoked}
"""
import json, os, sys
from web3 import Web3
from web3.exceptions import ContractLogicError

def load_abi(path: str):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data["abi"] if isinstance(data, dict) and "abi" in data else data

def get_contract():
    rpc = os.getenv("ETH_RPC_URL"); addr = os.getenv("CONTRACT_ADDRESS"); abi_path = os.getenv("CERTIFICATE_ABI_PATH")
    if not rpc or not addr or not abi_path:
        raise SystemExit(json.dumps({"error":"Missing ETH_RPC_URL / CONTRACT_ADDRESS / CERTIFICATE_ABI_PATH"}))
    w3 = Web3(Web3.HTTPProvider(rpc))
    if not w3.is_connected():
        raise SystemExit(json.dumps({"error":f"Cannot connect to RPC {rpc}"}))
    abi = load_abi(abi_path)
    return w3, w3.eth.contract(address=Web3.to_checksum_address(addr), abi=abi)

def main():
    if len(sys.argv) != 2:
        print(json.dumps({"error":"Usage: verify_certificate.py 0xFILE_HASH"})); return
    file_hash = sys.argv[1]
    try:
        _, contract = get_contract()
        fh_bytes = Web3.to_bytes(hexstr=file_hash)
        try:
            applicantIdHash, issuedAt, revoked = contract.functions.getCertificate(fh_bytes).call()
            out = {"exists": bool(int(issuedAt) > 0),
                   "applicantIdHash": ("0x" + applicantIdHash.hex()) if int(issuedAt) > 0 else None,
                   "issuedAt": int(issuedAt),
                   "revoked": bool(revoked)}
        except ContractLogicError:
            out = {"exists": False, "applicantIdHash": None, "issuedAt": 0, "revoked": True}
        print(json.dumps(out, separators=(",",":")))
    except Exception as e:
        print(json.dumps({"error":str(e)}, separators=(",",":")))

if __name__ == "__main__":
    main()
