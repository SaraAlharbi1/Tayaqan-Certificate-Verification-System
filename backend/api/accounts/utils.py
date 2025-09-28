# api/accounts/utils.py

"""
Normalization + hashing helpers (no web3 dependency).
"""

from eth_hash.auto import keccak  # small, reliable keccak-256

_ARABIC_TO_ASCII = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")


def normalize_national_id(raw: str) -> str:
    if raw is None:
        return ""
    s = raw.strip().translate(_ARABIC_TO_ASCII)
    s = "".join(ch for ch in s if ch.isdigit())
    return s


def normalize_cr_number(raw: str) -> str:
    if raw is None:
        return ""
    s = raw.strip().replace("-", "").replace("/", "").replace(" ", "")
    s = "".join(ch for ch in s if ch.isalnum()).upper()
    return s


def keccak256_hex(text: str) -> str:
    """
    keccak256 over UTF-8 text → '0x' + 64 hex
    Solidity: keccak256(abi.encodePacked(text))
    """
    return "0x" + keccak(text.encode("utf-8")).hex()
