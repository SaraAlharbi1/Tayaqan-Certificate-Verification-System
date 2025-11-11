# backend_scripts/issue_onchain.py
import os, sys, json, pathlib
from web3 import Web3
from dotenv import load_dotenv

BACKEND_ROOT = pathlib.Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_ROOT / ".env")

RPC = os.environ["ETH_RPC_URL"]
PK = os.environ["ISSUER_PRIVATE_KEY"].strip()
ADDR = os.environ["CONTRACT_ADDRESS"].strip()
ABI_PATH = os.environ["CERTIFICATE_ABI_PATH"].strip()

if len(sys.argv) < 3:
    raise SystemExit("usage: issue_onchain.py <applicant_hash_hex> <file_hash_hex>")

APPLICANT_HASH_HEX = sys.argv[1]  # "0x..." (64 hex chars after 0x)
FILE_HASH_HEX      = sys.argv[2]

# Basic validation
for name, h in [("applicant_hash", APPLICANT_HASH_HEX), ("file_hash", FILE_HASH_HEX)]:
    if not isinstance(h, str) or not h.startswith("0x") or len(h) != 66:
        raise SystemExit(f"{name} must be a 0x-prefixed 32-byte hex string (length 66)")

ABI_FILE = (BACKEND_ROOT / ABI_PATH).resolve()
artifact = json.loads(ABI_FILE.read_text(encoding="utf-8"))
ABI = artifact["abi"]

w3 = Web3(Web3.HTTPProvider(RPC))
if not w3.is_connected():
    raise RuntimeError(f"Cannot connect to {RPC}")

acct = w3.eth.account.from_key(PK)
contract = w3.eth.contract(address=Web3.to_checksum_address(ADDR), abi=ABI)

applicant_b32 = Web3.to_bytes(hexstr=APPLICANT_HASH_HEX)
file_b32      = Web3.to_bytes(hexstr=FILE_HASH_HEX)

tx = contract.functions.issueCertificate(applicant_b32, file_b32).build_transaction({
    "from": acct.address,
    "nonce": w3.eth.get_transaction_count(acct.address),
    "gas": 600000,
    "maxPriorityFeePerGas": 0,
    "maxFeePerGas": w3.to_wei(1, "gwei"),
    "chainId": w3.eth.chain_id,
})

signed = acct.sign_transaction(tx)
tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
rcpt = w3.eth.wait_for_transaction_receipt(tx_hash)

print(json.dumps({"tx": tx_hash.hex(), "block": rcpt.blockNumber}))
