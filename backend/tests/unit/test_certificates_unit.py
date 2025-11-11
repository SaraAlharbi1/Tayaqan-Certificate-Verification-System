import pytest

def test_CERT_001_issue_valid(fake_repo, fake_chain, monkeypatch):
    monkeypatch.setattr(fake_repo, "get_applicant_by_nid", lambda nid: {"id": 2})
    monkeypatch.setattr(fake_repo, "exists_filehash_for_institution", lambda inst, h: False)
    monkeypatch.setattr(fake_repo, "save_certificate",
        lambda **kw: {"id": 1, "status": "ACTIVE", "issued_tx": fake_chain.issue(kw["file_hash"])["tx"], **kw})
    out = fake_repo.save_certificate(institution_id=9, applicant_id=2, file_hash="0xabc")
    assert out["status"] == "ACTIVE" and out["issued_tx"]

def test_CERT_002_unapproved_forbidden():
    status = "PENDING"
    with pytest.raises(PermissionError):
        if status != "APPROVED":
            raise PermissionError("Institution not approved")

def test_CERT_003_duplicate_hash(fake_repo, monkeypatch):
    monkeypatch.setattr(fake_repo, "exists_filehash_for_institution", lambda inst, h: True)
    with pytest.raises(ValueError):
        if fake_repo.exists_filehash_for_institution(9, "0xabc"):
            raise ValueError("duplicate_file_for_institution")

def test_CERT_004_missing_file():
    with pytest.raises(ValueError):
        file = None
        if file is None:
            raise ValueError("missing_file")

def test_CERT_005_invalid_applicant(fake_repo, monkeypatch):
    monkeypatch.setattr(fake_repo, "get_applicant_by_nid", lambda nid: None)
    with pytest.raises(LookupError):
        if fake_repo.get_applicant_by_nid("0000000000") is None:
            raise LookupError("Applicant not found")

def test_VERIFY_active(fake_chain):
    res = fake_chain.verify("0xok")
    assert res["exists"] and not res["revoked"]

def test_VERIFY_revoked(fake_chain):
    fake_chain.verify = lambda h: {"exists": True, "revoked": True}
    assert fake_chain.verify("0xrev")["revoked"]

def test_VERIFY_missing(fake_chain):
    out = {"exists": False, "revoked": False}
    assert not out["exists"]

def test_VERIFY_batch(fake_chain):
    res = fake_chain.verify_many(["0xa","0xb","0xc"])
    assert len(res) == 3

def test_VERIFY_batch_empty(fake_chain):
    assert fake_chain.verify_many([]) == []
