#!/usr/bin/env python3
import os, sys, json
from web3 import Web3

def load_abi(p):
    with open(p, "r", encoding="utf-8") as f:
        d = json.load(f)
    return d.get("abi", d)

def norm(h: str) -> str:
    h = (h or "").strip().lower()
    return h if h.startswith("0x") else "0x"+h

if len(sys.argv) < 3:
    print(json.dumps({"error":"usage","message":"python issue_onchain.py 0x<applicant_hash> 0x<file_hash>"})); sys.exit(2)

RPC  = os.getenv("ETH_RPC_URL")
ADDR = os.getenv("CONTRACT_ADDRESS")
ABI  = os.getenv("CERTIFICATE_ABI_PATH")
KEY  = os.getenv("PRIVATE_KEY")
FROM = os.getenv("FROM_ADDRESS")

if not all([RPC, ADDR, ABI, KEY]):
    print(json.dumps({"error":"missing_env"})); sys.exit(1)

w3 = Web3(Web3.HTTPProvider(RPC))
if not w3.is_connected():
    print(json.dumps({"error":"rpc_unreachable"})); sys.exit(1)

try:
    contract = w3.eth.contract(address=Web3.to_checksum_address(ADDR), abi=load_abi(ABI))
except Exception as e:
    print(json.dumps({"error":"bad_contract","detail":str(e)})); sys.exit(1)

acct   = w3.eth.account.from_key(KEY)
sender = Web3.to_checksum_address(FROM) if FROM else acct.address

app_hash_hex  = norm(sys.argv[1])
file_hash_hex = norm(sys.argv[2])

try:
    app_hash_b32  = Web3.to_bytes(hexstr=app_hash_hex)
    file_hash_b32 = Web3.to_bytes(hexstr=file_hash_hex)
    if len(app_hash_b32) != 32 or len(file_hash_b32) != 32:
        raise ValueError("hash != 32 bytes")
except Exception as e:
    print(json.dumps({"error":"bad_hash","detail":str(e)})); sys.exit(1)

fn = contract.functions.issueCertificate(app_hash_b32, file_hash_b32)

try:
    gas     = fn.estimate_gas({"from": sender})
    nonce   = w3.eth.get_transaction_count(sender)
    tx      = fn.build_transaction({
        "from": sender,
        "nonce": nonce,
        "gas": gas,
        "gasPrice": w3.eth.gas_price
    })
    signed  = w3.eth.account.sign_transaction(tx, private_key=KEY)
    tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
    rcpt    = w3.eth.wait_for_transaction_receipt(tx_hash)
    print(json.dumps({"tx": tx_hash.hex(), "block": int(rcpt.blockNumber), "status": int(rcpt.status)}))
except Exception as e:
    print(json.dumps({"error":"send_failed","detail":str(e)})); sys.exit(1)
