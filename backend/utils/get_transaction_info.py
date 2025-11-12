#!/usr/bin/env python3
"""
Transaction Info Retrieval for Certificates

Returns issuance/revocation tx details by scanning contract events.

Env (.env auto-loaded from BACKEND_ROOT):
  ETH_RPC_URL / WEB3_RPC_URL  - Ethereum RPC endpoint
  CONTRACT_ADDRESS            - Deployed contract address
  CERTIFICATE_ABI_PATH        - Path to ABI (Hardhat artifact or raw ABI JSON)
  TXINFO_START_BLOCK          - Optional start block (int)

Usage:
  python utils/get_transaction_info.py 0x<file_hash_32bytes>

Output (single-line JSON):
  {"fileHash","issuedTx","issuedBlock","revokeTx","revokeBlock"}  (nulls if missing)
"""
import os, sys, json
from pathlib import Path
from dotenv import load_dotenv
from web3 import Web3

BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_ROOT / ".env")


def _load_abi(path: str):
    p = Path(path)
    if not p.is_absolute():
        p = (BACKEND_ROOT / path).resolve()
    with p.open("r", encoding="utf-8") as f:
        data = json.load(f)
    return data["abi"] if isinstance(data, dict) and "abi" in data else data


def _norm_hex(h: str) -> str:
    h = (h or "").strip().lower()
    return h if h.startswith("0x") else "0x" + h


def _as_bytes32(h: str) -> bytes:
    try:
        b = Web3.to_bytes(hexstr=_norm_hex(h))
        if len(b) != 32:
            raise ValueError("hash != 32 bytes")
        return b
    except Exception as e:
        print(json.dumps({"error": "bad_hash", "detail": str(e)}))
        sys.exit(1)


def _auto_from_block(default: int = 0) -> int:
    v = os.getenv("TXINFO_START_BLOCK")
    if v:
        try:
            return int(v, 0)  # supports "0x.." or decimal
        except Exception:
            pass
    return default


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "missing_arg", "usage": "python utils/get_transaction_info.py 0x<file_hash_32bytes>"}))
        return

    rpc = os.getenv("ETH_RPC_URL") or os.getenv("WEB3_RPC_URL")
    addr = os.getenv("CONTRACT_ADDRESS")
    abi_path = os.getenv("CERTIFICATE_ABI_PATH")

    missing = []
    if not rpc:      missing.append("ETH_RPC_URL|WEB3_RPC_URL")
    if not addr:     missing.append("CONTRACT_ADDRESS")
    if not abi_path: missing.append("CERTIFICATE_ABI_PATH")
    if missing:
        print(json.dumps({"error": "missing_env", "missing": missing}))
        return

    try:
        w3 = Web3(Web3.HTTPProvider(rpc))
        if not w3.is_connected():
            print(json.dumps({"error": "rpc_unreachable", "detail": rpc}))
            return
    except Exception as e:
        print(json.dumps({"error": "rpc_provider_error", "detail": str(e)}))
        return

    try:
        abi = _load_abi(abi_path)
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(addr),
            abi=abi
        )
    except Exception as e:
        print(json.dumps({"error": "bad_contract", "detail": str(e)}))
        return

    file_hash_hex = _norm_hex(sys.argv[1])
    file_hash = _as_bytes32(file_hash_hex)

    try:
        latest = w3.eth.block_number
    except Exception as e:
        print(json.dumps({"error": "rpc_block_error", "detail": str(e)}))
        return

    from_block = max(0, min(_auto_from_block(0), latest))

    issued_tx = issued_blk = revoked_tx = revoked_blk = None

    # event CertificateIssued(bytes32 indexed applicantIdHash, bytes32 indexed fileHash, uint64 issuedAt);
    try:
        ev_issued = contract.events.CertificateIssued().get_logs(
            from_block=from_block,
            to_block=latest,
            argument_filters={"fileHash": file_hash},
        )
        if ev_issued:
            e = sorted(ev_issued, key=lambda x: (x["blockNumber"], x["logIndex"]))[-1]
            issued_tx = e["transactionHash"].hex()
            issued_blk = int(e["blockNumber"])
    except Exception:
        pass

    # event CertificateRevoked(bytes32 indexed fileHash, uint64 revokedAt);
    try:
        ev_revoked = contract.events.CertificateRevoked().get_logs(
            from_block=from_block,
            to_block=latest,
            argument_filters={"fileHash": file_hash},
        )
        if ev_revoked:
            e = sorted(ev_revoked, key=lambda x: (x["blockNumber"], x["logIndex"]))[-1]
            revoked_tx = e["transactionHash"].hex()
            revoked_blk = int(e["blockNumber"])
    except Exception:
        pass

    print(json.dumps(
        {
            "fileHash": file_hash_hex,
            "issuedTx": issued_tx,
            "issuedBlock": issued_blk,
            "revokeTx": revoked_tx,
            "revokeBlock": revoked_blk,
        },
        separators=(",", ":")
    ))


if __name__ == "__main__":
    main()
