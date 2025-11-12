"""
Blockchain Service - Read-only blockchain operations wrapper.
Provides methods for certificate verification and transaction info retrieval.
"""
from __future__ import annotations
import json
import subprocess
import sys
import os
from pathlib import Path
from typing import Dict, List, Union

Json = Union[Dict, List, str, int, float, bool, None]


def _norm(h: str) -> str:
    """Normalize hash to lowercase with 0x prefix."""
    if not h:
        return ""
    h = h.strip().lower()
    return h if h.startswith("0x") else ("0x" + h)


def _as_bool(x) -> bool:
    """Convert various types to boolean."""
    if isinstance(x, bool):
        return x
    if isinstance(x, (int, float)):
        return x != 0
    if isinstance(x, str):
        return x.strip().lower() in {"true", "1", "yes"}
    return False


class BlockchainService:
    """
    Read-only blockchain operations for certificate management.
    Handles single/batch verification and transaction info retrieval.
    """

    # Script paths relative to this file
    _UTILS_DIR = Path(__file__).resolve().parent
    _VERIFY_SINGLE = _UTILS_DIR / "verify_certificate.py"
    _VERIFY_BATCH = _UTILS_DIR / "verify_certificates_batch.py"
    _GET_TX_INFO = _UTILS_DIR / "get_transaction_info.py"

    @staticmethod
    def _run_json(cmd: List[str], timeout: int) -> Json:
        """Execute a command and parse JSON output."""
        try:
            out = subprocess.check_output(
                cmd,
                text=True,
                stderr=subprocess.STDOUT,
                timeout=timeout,
                env={**os.environ, "PYTHONWARNINGS": "ignore"},
            )
            return json.loads((out or "").strip()) if out else {}
        except subprocess.CalledProcessError as e:
            # Try to parse error output as JSON
            txt = (e.output or "").strip()
            if txt:
                try:
                    return json.loads(txt)
                except Exception:
                    return {"error": txt[:400]}
            return {"error": str(e)}
        except Exception as e:
            return {"error": str(e)}

    @staticmethod
    def verify_certificate(file_hash: str) -> Dict:
        """
        Verify a single certificate on-chain.
        
        Args:
            file_hash: Certificate file hash (hex string)
            
        Returns:
            Dict with keys: exists, revoked, applicantIdHash, issuedAt
        """
        fh = _norm(file_hash)
        if not fh or not BlockchainService._VERIFY_SINGLE.exists():
            return {"exists": False, "revoked": True}

        raw = BlockchainService._run_json(
            [sys.executable, str(BlockchainService._VERIFY_SINGLE), fh],
            timeout=30,
        )
        
        # Handle string response
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except Exception:
                raw = {}

        if not isinstance(raw, dict):
            return {"exists": False, "revoked": True}

        return {
            "exists": _as_bool(raw.get("exists")),
            "revoked": _as_bool(raw.get("revoked")),
            "applicantIdHash": raw.get("applicantIdHash"),
            "issuedAt": raw.get("issuedAt", 0),
        }

    @staticmethod
    def verify_certificates_batch(file_hashes: List[str]) -> Dict[str, Dict]:
        """
        Batch verify multiple certificates (optimized for list views).
        
        Args:
            file_hashes: List of certificate file hashes
            
        Returns:
            Dict mapping normalized hash to verification result
        """
        file_hashes = [_norm(h) for h in (file_hashes or []) if h]
        if not file_hashes:
            return {}

        raw = {}
        if BlockchainService._VERIFY_BATCH.exists():
            raw = BlockchainService._run_json(
                [sys.executable, str(BlockchainService._VERIFY_BATCH), *file_hashes],
                timeout=60,
            )

        result: Dict[str, Dict] = {}

        # Handle dict response (hash -> result mapping)
        if isinstance(raw, dict):
            for k, v in raw.items():
                fh = _norm(str(k))
                v = {} if v is None else (json.loads(v) if isinstance(v, str) else v)
                if not isinstance(v, dict):
                    v = {}
                result[fh] = {
                    "fileHash": fh,
                    "exists": _as_bool(v.get("exists")),
                    "revoked": _as_bool(v.get("revoked")),
                }
            return result

        # Handle list response (array of results)
        if isinstance(raw, list):
            for it in raw:
                it = {} if it is None else (json.loads(it) if isinstance(it, str) else it)
                if not isinstance(it, dict):
                    continue
                fh = _norm(it.get("fileHash") or it.get("hash") or it.get("file_hash") or "")
                if not fh:
                    continue
                result[fh] = {
                    "fileHash": fh,
                    "exists": _as_bool(it.get("exists")),
                    "revoked": _as_bool(it.get("revoked")),
                }
            return result

        # Fallback: mark all as non-existent
        return {h: {"fileHash": h, "exists": False, "revoked": True} for h in file_hashes}

    @staticmethod
    def get_transaction_info(file_hash: str) -> Dict:
        """
        Get blockchain transaction details for a certificate.
        
        Args:
            file_hash: Certificate file hash
            
        Returns:
            Dict with keys: issuedTx, issuedBlock, revokeTx, revokeBlock
            (values are None if not found)
        """
        fh = _norm(file_hash)
        if not fh or not BlockchainService._GET_TX_INFO.exists():
            return {}
            
        data = BlockchainService._run_json(
            [sys.executable, str(BlockchainService._GET_TX_INFO), fh],
            timeout=30,
        )
        
        # Handle string response
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except Exception:
                data = {}
                
        if not isinstance(data, dict):
            return {}

        # Extract transaction info with fallback keys
        issued_tx = data.get("issuedTx") or data.get("tx") or data.get("txHash") or data.get("issue_tx")
        issued_blk = data.get("issuedBlock") or data.get("block") or data.get("blockNumber") or data.get("issue_block")
        revoke_tx = data.get("revokeTx") or data.get("revoke_tx")
        revoke_blk = data.get("revokeBlock") or data.get("revoke_block")

        return {
            "issuedTx": issued_tx,
            "issuedBlock": issued_blk,
            "revokeTx": revoke_tx,
            "revokeBlock": revoke_blk,
        }