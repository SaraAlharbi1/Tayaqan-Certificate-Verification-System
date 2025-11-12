#!/usr/bin/env python3
"""
Certificate Revocation - On-Chain Transaction

Revokes a certificate by calling revokeCertificate(fileHash).

Usage:
  python revoke_onchain.py 0x<file_hash_32bytes>

Env (inherited from Django or .env):
  ETH_RPC_URL / WEB3_RPC_URL  - RPC HTTP endpoint
  CONTRACT_ADDRESS            - Contract address
  CERTIFICATE_ABI_PATH        - Path to ABI (Hardhat artifact or raw ABI)
  PRIVATE_KEY / ISSUER_PRIVATE_KEY
  FROM_ADDRESS                - (optional) explicit sender
  CHAIN_ID                    - (optional) chain id

Output: {"tx","block","status"} or {"error",...}
"""
import os
import sys
import json
from pathlib import Path
from web3 import Web3
from dotenv import load_dotenv

# ---------- robust .env loading (non-destructive) ----------
CUR = Path(__file__).resolve()
BACKEND_ROOT = CUR
for _ in range(6):  # walk up to 6 levels to find backend/.env
    if (BACKEND_ROOT / ".env").exists():
        load_dotenv(BACKEND_ROOT / ".env", override=False)
        break
    BACKEND_ROOT = BACKEND_ROOT.parent

# ---------- helpers ----------
def _load_abi(p: str):
    path = Path(p)
    if not path.is_absolute():
        path = (BACKEND_ROOT / p).resolve()
    with path.open("r", encoding="utf-8") as f:
        d = json.load(f)
    return d.get("abi", d)

def _norm(h: str) -> str:
    h = (h or "").strip().lower()
    return h if h.startswith("0x") else "0x" + h

def _as_bytes32(h: str) -> bytes:
    try:
        b = Web3.to_bytes(hexstr=_norm(h))
        if len(b) != 32:
            raise ValueError("hash != 32 bytes")
        return b
    except Exception as e:
        print(json.dumps({"error": "bad_hash", "detail": str(e)}))
        sys.exit(1)

def _need(name: str, *aliases: str) -> str:
    for k in (name, *aliases):
        v = os.getenv(k)
        if v:
            return v
    print(json.dumps({"error": "missing_env", "missing": [name, *aliases]}))
    sys.exit(1)

# ---------- args ----------
if len(sys.argv) < 2:
    print(json.dumps({"error": "usage", "message": "python revoke_onchain.py 0x<file_hash>"}))
    sys.exit(2)

file_hash_b32 = _as_bytes32(sys.argv[1])

# ---------- env ----------
RPC  = os.getenv("ETH_RPC_URL") or os.getenv("WEB3_RPC_URL")
ADDR = _need("CONTRACT_ADDRESS")
ABI  = _need("CERTIFICATE_ABI_PATH")
KEY  = _need("PRIVATE_KEY", "ISSUER_PRIVATE_KEY")
FROM = os.getenv("FROM_ADDRESS")
CHAIN_ID = None
try:
    cid_env = os.getenv("CHAIN_ID")
    CHAIN_ID = int(cid_env) if cid_env else None
except Exception:
    CHAIN_ID = None

if not RPC:
    print(json.dumps({"error": "missing_env", "missing": ["ETH_RPC_URL|WEB3_RPC_URL"]}))
    sys.exit(1)

# ---------- web3 / contract ----------
w3 = Web3(Web3.HTTPProvider(RPC))
if not w3.is_connected():
    print(json.dumps({"error": "rpc_unreachable", "detail": RPC}))
    sys.exit(1)

try:
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(ADDR),
        abi=_load_abi(ABI),
    )
except Exception as e:
    print(json.dumps({"error": "bad_contract", "detail": str(e)}))
    sys.exit(1)

acct   = w3.eth.account.from_key(KEY)
sender = Web3.to_checksum_address(FROM) if FROM else acct.address

# ---------- tx build / sign / send ----------
fn = contract.functions.revokeCertificate(file_hash_b32)

try:
    gas   = fn.estimate_gas({"from": sender})
    nonce = w3.eth.get_transaction_count(sender)

    # Legacy-style gas by default; add chainId if available/required.
    tx = fn.build_transaction({
        "from": sender,
        "nonce": nonce,
        "gas": gas,
        "gasPrice": w3.eth.gas_price,
        **({"chainId": CHAIN_ID} if CHAIN_ID else {}),
    })

    signed = w3.eth.account.sign_transaction(tx, private_key=KEY)
    raw    = getattr(signed, "rawTransaction", None) or getattr(signed, "raw_transaction", None)
    if raw is None:
        print(json.dumps({"error": "send_failed", "detail": "missing raw tx bytes"}))
        sys.exit(1)

    tx_hash = w3.eth.send_raw_transaction(raw)
    rcpt    = w3.eth.wait_for_transaction_receipt(tx_hash)

    print(json.dumps({
        "tx": tx_hash.hex(),
        "block": int(rcpt.blockNumber),
        "status": int(rcpt.status),
    }))
except Exception as e:
    print(json.dumps({"error": "send_failed", "detail": str(e)}))
    sys.exit(1)
