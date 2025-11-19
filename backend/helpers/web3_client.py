"""Web3 client configuration and utilities."""

import os
from web3 import Web3
from eth_account import Account

# Environment variables
RPC_URL = os.environ.get("WEB3_RPC_URL")
ADMIN_PRIVATE_KEY = os.environ.get("ADMIN_PRIVATE_KEY")

# Initialize Web3
if RPC_URL:
    w3 = Web3(Web3.HTTPProvider(RPC_URL))
    print(f"[web3_client] Connected to: {RPC_URL}")
else:
    w3 = None
    print("[web3_client] No RPC_URL configured")

# Initialize admin account
try:
    if ADMIN_PRIVATE_KEY:
        _admin = Account.from_key(ADMIN_PRIVATE_KEY)
        ADMIN_ADDRESS = Web3.to_checksum_address(_admin.address)
        print(f"[web3_client] Admin wallet: {ADMIN_ADDRESS}")
    else:
        ADMIN_ADDRESS = None
        print("[web3_client] No admin private key configured")
except Exception as e:
    ADMIN_ADDRESS = None
    print(f"[web3_client] Admin wallet error: {e}")

# InstitutionRegistry address (from deployment)
INSTITUTION_REGISTRY_ADDRESS = os.environ.get("INSTITUTION_REGISTRY_ADDRESS")
if INSTITUTION_REGISTRY_ADDRESS:
    INSTITUTION_REGISTRY_ADDRESS = Web3.to_checksum_address(INSTITUTION_REGISTRY_ADDRESS)
    print(f"[web3_client] InstitutionRegistry: {INSTITUTION_REGISTRY_ADDRESS}")
else:
    print("[web3_client] No InstitutionRegistry address configured")


def is_configured() -> bool:
    """Check if Web3 is fully configured."""
    return bool(w3 and ADMIN_PRIVATE_KEY and ADMIN_ADDRESS and INSTITUTION_REGISTRY_ADDRESS)