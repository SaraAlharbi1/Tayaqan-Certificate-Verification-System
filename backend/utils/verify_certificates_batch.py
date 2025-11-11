# utils/verify_certificates_batch.py
import json, os, sys, pathlib
from web3 import Web3
from dotenv import load_dotenv

BACKEND_ROOT = pathlib.Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_ROOT / ".env")

def load_abi(path: str):
    p = (BACKEND_ROOT / path).resolve() if not os.path.isabs(path) else pathlib.Path(path)
    with open(p, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data["abi"] if isinstance(data, dict) and "abi" in data else data

def get_contract():
    rpc = os.getenv("ETH_RPC_URL")
    addr = os.getenv("CONTRACT_ADDRESS")
    abi_path = os.getenv("CERTIFICATE_ABI_PATH")
    if not rpc or not addr or not abi_path:
        raise RuntimeError("Missing ETH_RPC_URL / CONTRACT_ADDRESS / CERTIFICATE_ABI_PATH")
    w3 = Web3(Web3.HTTPProvider(rpc))
    if not w3.is_connected():
        raise RuntimeError(f"Cannot connect to RPC {rpc}")
    abi = load_abi(abi_path)
    return w3.eth.contract(address=Web3.to_checksum_address(addr), abi=abi)

def main():
    file_hashes = [h.lower() for h in sys.argv[1:]]
    if not file_hashes:
        print("[]"); return
    try:
        c = get_contract()
        fh_bytes = [Web3.to_bytes(hexstr=h) for h in file_hashes]
        results = c.functions.getCertificatesBatch(fh_bytes).call()
        out = []
        for i, (applicantIdHash, issuedAt, revoked) in enumerate(results):
            out.append({"fileHash": file_hashes[i], "exists": int(issuedAt) > 0, "revoked": bool(revoked)})
        print(json.dumps(out, separators=(",",":")))
    except Exception as e:
        print(json.dumps([{"fileHash": h, "exists": False, "revoked": True, "error": str(e)} for h in file_hashes], separators=(",",":")))

if __name__ == "__main__":
    main()
