#!/usr/bin/env python3
"""
issue_onchain.py  —  Send issueCertificate(applicantIdHash, fileHash)

- Works with Web3.py v6+ (raw_transaction attr) and v5 (rawTransaction).
- Reports exactly which env var is missing.
- Accepts legacy names: WEB3_RPC_URL, ISSUER_PRIVATE_KEY.
- Resolves ABI path absolutely to avoid relative-path/CWD issues.
"""

import os, sys, json
from pathlib import Path
from web3 import Web3

# ---------- helpers ----------
def _load_abi(p: str):
    p = Path(p).expanduser().resolve()
    with p.open("r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("abi", data)

def _norm_hex(h: str) -> str:
    h = (h or "").strip().lower()
    return h if h.startswith("0x") else "0x" + h

def _need(name: str, *aliases: str) -> str:
    for k in (name, *aliases):
        v = os.getenv(k)
        if v:
            return v
    print(json.dumps({"error": "missing_env", "missing": [name, *aliases]}))
    sys.exit(1)

def _as_bytes32(hexstr: str) -> bytes:
    try:
        b = Web3.to_bytes(hexstr=_norm_hex(hexstr))
        if len(b) != 32:
            raise ValueError("hash != 32 bytes")
        return b
    except Exception as e:
        print(json.dumps({"error": "bad_hash", "detail": str(e)}))
        sys.exit(1)

# ---------- args ----------
if len(sys.argv) < 3:
    print(json.dumps({
        "error": "usage",
        "message": "python issue_onchain.py 0x<applicant_hash32> 0x<file_hash32>"
    }))
    sys.exit(2)

app_hash_b32  = _as_bytes32(sys.argv[1])
file_hash_b32 = _as_bytes32(sys.argv[2])

# ---------- env (with fallbacks) ----------
RPC  = _need("ETH_RPC_URL", "WEB3_RPC_URL")
ADDR = _need("CONTRACT_ADDRESS")
ABI  = _need("CERTIFICATE_ABI_PATH")
KEY  = _need("PRIVATE_KEY", "ISSUER_PRIVATE_KEY")
FROM = os.getenv("FROM_ADDRESS")  # optional

# ---------- web3 / contract ----------
w3 = Web3(Web3.HTTPProvider(RPC))
if not w3.is_connected():
    print(json.dumps({"error": "rpc_unreachable"})); sys.exit(1)

try:
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(ADDR),
        abi=_load_abi(ABI),
    )
except Exception as e:
    print(json.dumps({"error": "bad_contract", "detail": str(e)})); sys.exit(1)

acct   = w3.eth.account.from_key(KEY)
sender = Web3.to_checksum_address(FROM) if FROM else acct.address

# ---------- build + send tx ----------
fn = contract.functions.issueCertificate(app_hash_b32, file_hash_b32)

try:
    gas   = fn.estimate_gas({"from": sender})
    nonce = w3.eth.get_transaction_count(sender)

    # Legacy gas fields (compatible with Hardhat/Anvil).
    # If your node enforces EIP-1559, switch to maxFeePerGas / maxPriorityFeePerGas.
    tx = fn.build_transaction({
        "from": sender,
        "nonce": nonce,
        "gas": gas,
        "gasPrice": w3.eth.gas_price,
        # "chainId": getattr(w3.eth, "chain_id", None) or int(os.getenv("CHAIN_ID", "0")) or None,
    })

    signed = w3.eth.account.sign_transaction(tx, private_key=KEY)
    raw    = getattr(signed, "rawTransaction", None) or getattr(signed, "raw_transaction", None)
    if raw is None:
        print(json.dumps({"error": "send_failed", "detail": "missing raw tx bytes"})); sys.exit(1)

    tx_hash = w3.eth.send_raw_transaction(raw)
    rcpt    = w3.eth.wait_for_transaction_receipt(tx_hash)

    print(json.dumps({
        "tx": tx_hash.hex(),
        "block": int(rcpt.blockNumber),
        "status": int(rcpt.status),
    }))
except Exception as e:
    print(json.dumps({"error": "send_failed", "detail": str(e)})); sys.exit(1)
