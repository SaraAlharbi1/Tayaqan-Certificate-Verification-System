#!/usr/bin/env python3
# backend_scripts/revoke_onchain.py
import os, sys, json, pathlib
from web3 import Web3
from web3.exceptions import ContractLogicError
from dotenv import load_dotenv

BACKEND_ROOT = pathlib.Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_ROOT / ".env")

RPC = os.environ["ETH_RPC_URL"]
PK = os.environ["ISSUER_PRIVATE_KEY"].strip()
ADDR = os.environ["CONTRACT_ADDRESS"].strip()
ABI_PATH = os.environ["CERTIFICATE_ABI_PATH"].strip()

if len(sys.argv) < 2:
    raise SystemExit("usage: revoke_onchain.py <file_hash>")
FILE_HASH = sys.argv[1]

ABI_FILE = (BACKEND_ROOT / ABI_PATH).resolve()
if not ABI_FILE.exists():
    raise FileNotFoundError(f"ABI not found at {ABI_FILE}")
artifact = json.loads(ABI_FILE.read_text(encoding="utf-8"))
ABI = artifact["abi"]

w3 = Web3(Web3.HTTPProvider(RPC))
if not w3.is_connected():
    raise RuntimeError(f"Cannot connect to {RPC}")

acct = w3.eth.account.from_key(PK)
contract = w3.eth.contract(address=Web3.to_checksum_address(ADDR), abi=ABI)

fn = contract.functions.revokeCertificate(FILE_HASH)

# simulate first for readable revert
try:
    fn.call({"from": acct.address})
except ContractLogicError as e:
    print(json.dumps({"error": "SIMULATION_REVERT", "reason": str(e)}))
    sys.exit(3)

tx = fn.build_transaction({
    "from": acct.address,
    "nonce": w3.eth.get_transaction_count(acct.address),
    "gas": 300000,
    "maxPriorityFeePerGas": 0,
    "maxFeePerGas": w3.to_wei(1, "gwei"),
    "chainId": w3.eth.chain_id,
})
signed = acct.sign_transaction(tx)
tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

print(json.dumps({"tx": tx_hash.hex(), "block": receipt.blockNumber}))
