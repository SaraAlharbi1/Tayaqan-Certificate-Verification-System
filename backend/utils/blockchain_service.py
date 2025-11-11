from __future__ import annotations
import json, subprocess, sys, os
from pathlib import Path
from typing import Dict, List, Union

Json = Union[Dict, List, str, int, float, bool, None]


def _norm(h: str) -> str:
    if not h:
        return ""
    h = h.strip().lower()
    return h if h.startswith("0x") else ("0x" + h)


def _as_bool(x) -> bool:
    if isinstance(x, bool):
        return x
    if isinstance(x, (int, float)):
        return x != 0
    if isinstance(x, str):
        return x.strip().lower() in {"true", "1", "yes"}
    return False


class BlockchainService:
    """Blockchain certificate operations (read-only). Single + Batch + tx-info."""
    _UTILS_DIR         = Path(__file__).resolve().parent
    _VERIFY_SINGLE     = _UTILS_DIR / "verify_certificate.py"
    _VERIFY_BATCH      = _UTILS_DIR / "verify_certificates_batch.py"
    _GET_TX_INFO       = _UTILS_DIR / "get_transaction_info.py"

    @staticmethod
    def _run_json(cmd: List[str], timeout: int) -> Json:
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
            txt = (e.output or "").strip()
            if txt:
                try:
                    return json.loads(txt)
                except Exception:
                    return {"error": txt[:400]}
            return {"error": str(e)}
        except Exception as e:
            return {"error": str(e)}

    # ---------------- single verify (NEW) ----------------
    @staticmethod
    def verify_certificate(file_hash: str) -> Dict:
        """
        Verify a single certificate (more efficient than batch for detail views).
        Returns:
        {
          "exists": bool,
          "revoked": bool,
          "applicantIdHash": "0x..." or None,
          "issuedAt": int
        }
        """
        fh = _norm(file_hash)
        if not fh or not BlockchainService._VERIFY_SINGLE.exists():
            return {"exists": False, "revoked": True}

        raw = BlockchainService._run_json(
            [sys.executable, str(BlockchainService._VERIFY_SINGLE), fh],
            timeout=30,
        )

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

    # ---------------- batch verify ----------------
    @staticmethod
    def verify_certificates_batch(file_hashes: List[str]) -> Dict[str, Dict]:
        """
        Verify multiple certificates in one call (for list views).
        Returns mapping:
        {
          "<0xhash>": {"fileHash":"<0xhash>","exists":bool,"revoked":bool}
        }
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

        # Dict form: {"0x..": {...}}
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

        # List form: [{"fileHash": "...", "exists":..., "revoked":...}, ...]
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

        # Unknown shape → mark invalid
        return {h: {"fileHash": h, "exists": False, "revoked": True} for h in file_hashes}

    # ---------------- tx-info ----------------
    @staticmethod
    def get_transaction_info(file_hash: str) -> Dict:
        """
        Returns {issuedTx, issuedBlock, revokeTx, revokeBlock} (keys may be None).
        """
        fh = _norm(file_hash)
        if not fh or not BlockchainService._GET_TX_INFO.exists():
            return {}
        data = BlockchainService._run_json(
            [sys.executable, str(BlockchainService._GET_TX_INFO), fh],
            timeout=30,
        )
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except Exception:
                data = {}
        if not isinstance(data, dict):
            return {}

        issued_tx  = data.get("issuedTx")  or data.get("tx") or data.get("txHash") or data.get("issue_tx")
        issued_blk = data.get("issuedBlock") or data.get("block") or data.get("blockNumber") or data.get("issue_block")
        revoke_tx  = data.get("revokeTx")  or data.get("revoke_tx")
        revoke_blk = data.get("revokeBlock") or data.get("revoke_block")

        return {
            "issuedTx": issued_tx,
            "issuedBlock": issued_blk,
            "revokeTx": revoke_tx,
            "revokeBlock": revoke_blk,
        }