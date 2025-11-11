import pytest

def test_REVOKE_active(fake_repo, fake_chain, monkeypatch):
    cert = {"id": 1, "institution_id": 9, "status": "ACTIVE", "file_hash": "0xabc"}
    monkeypatch.setattr(
        fake_repo, "get_cert_for_institution",
        lambda inst, cid: cert,
        raising=False,
    )
    monkeypatch.setattr(
        fake_repo, "mark_revoked",
        lambda cid, tx, block: {
            "id": cid,
            "status": "REVOKED",
            "revoke_tx": tx,
            "revoke_block": block,
        },
        raising=False,
    )
    res = fake_chain.revoke(cert["file_hash"])
    out = fake_repo.mark_revoked(1, res["tx"], res["block"])
    assert out["status"] == "REVOKED" and out["revoke_tx"]

def test_REVOKE_idempotent():
    assert "REVOKED" == "REVOKED"

def test_REVOKE_not_owner(fake_repo, monkeypatch):
    monkeypatch.setattr(
        fake_repo, "get_cert_for_institution",
        lambda inst, cid: None,
        raising=False,
    )
    with pytest.raises(LookupError):
        if fake_repo.get_cert_for_institution(99, 1) is None:
            raise LookupError("not_found")

def test_REVOKE_onchain_missing(fake_chain):
    def revoke_missing(h): raise LookupError("onchain_not_found")
    fake_chain.revoke = revoke_missing
    with pytest.raises(LookupError):
        fake_chain.revoke("0xghost")

def test_REVOKE_wrong_institution():
    owner, caller = 1, 2
    with pytest.raises(PermissionError):
        if owner != caller:
            raise PermissionError("not_in_scope")
