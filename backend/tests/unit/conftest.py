import types
import pytest

@pytest.fixture
def fake_repo():
    return types.SimpleNamespace()

@pytest.fixture
def fake_chain():
    return types.SimpleNamespace(
        issue=lambda h: {"tx": "0xISSUED", "block": 111},
        revoke=lambda h: {"tx": "0xREVOKE", "block": 222},
        get_tx_info=lambda h: {"issuedTx": "0xISSUED", "issuedBlock": 111, "revokeTx": None, "revokeBlock": None},
        verify=lambda h: {"exists": True, "revoked": False},
        verify_many=lambda hs: [{"fileHash": h, "exists": (h != "0xinvalid"), "revoked": (h == "0xrevoked")} for h in hs],
    )

@pytest.fixture
def fake_storage():
    return types.SimpleNamespace(
        download_bytes=lambda cid: b"%PDF-1.4\n...",
        decrypt=lambda enc, key: b"%PDF-1.4\nDECRYPTED\n",
    )
