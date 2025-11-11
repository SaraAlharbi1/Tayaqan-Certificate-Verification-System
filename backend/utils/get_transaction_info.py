#!/usr/bin/env python3
import os, sys, json
from web3 import Web3

# ENV:
# ETH_RPC_URL, CONTRACT_ADDRESS, CERTIFICATE_ABI_PATH
def load_abi(path: str):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data["abi"] if isinstance(data, dict) and "abi" in data else data

def main():
    if len(sys.argv) < 2:
        print("{}"); return
    rpc  = os.getenv("ETH_RPC_URL")
    addr = os.getenv("CONTRACT_ADDRESS")
    abi_path = os.getenv("CERTIFICATE_ABI_PATH")
    if not rpc or not addr or not abi_path:
        print(json.dumps({"error":"Missing ETH_RPC_URL / CONTRACT_ADDRESS / CERTIFICATE_ABI_PATH"})); return

    w3 = Web3(Web3.HTTPProvider(rpc))
    if not w3.is_connected():
        print(json.dumps({"error":f"Cannot connect to RPC {rpc}"})); return

    abi = load_abi(abi_path)
    c = w3.eth.contract(address=Web3.to_checksum_address(addr), abi=abi)

    file_hash_hex = sys.argv[1]              # "0x.."
    file_hash = Web3.to_bytes(hexstr=file_hash_hex)

    # ---- Scan events from genesis to latest (local chain; fine for MVP) ----
    latest = w3.eth.block_number
    from_block = 0

    issued_tx = None
    issued_blk = None
    revoked_tx = None
    revoked_blk = None

    try:
        # CertificateIssued(bytes32 applicantIdHash, bytes32 fileHash, uint64 issuedAt)
        ev_issued = c.events.CertificateIssued().get_logs(
            fromBlock=from_block, toBlock=latest, argument_filters={"fileHash": file_hash}
        )
        if ev_issued:
            # pick the MOST RECENT by blockNumber/logIndex
            e = sorted(ev_issued, key=lambda x:(x["blockNumber"], x["logIndex"]))[-1]
            issued_tx = e["transactionHash"].hex()
            issued_blk = e["blockNumber"]
    except Exception as _:
        pass

    try:
        # CertificateRevoked(bytes32 fileHash, uint64 revokedAt)
        ev_revoked = c.events.CertificateRevoked().get_logs(
            fromBlock=from_block, toBlock=latest, argument_filters={"fileHash": file_hash}
        )
        if ev_revoked:
            e = sorted(ev_revoked, key=lambda x:(x["blockNumber"], x["logIndex"]))[-1]
            revoked_tx = e["transactionHash"].hex()
            revoked_blk = e["blockNumber"]
    except Exception as _:
        pass

    out = {
        "fileHash": file_hash_hex,
        "issuedTx": issued_tx,
        "issuedBlock": issued_blk,
        "revokeTx": revoked_tx,
        "revokeBlock": revoked_blk,
    }
    print(json.dumps(out, separators=(",",":")))

if __name__ == "__main__":
    main()
