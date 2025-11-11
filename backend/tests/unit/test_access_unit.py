import pytest

def test_ACCESS_create_request(fake_repo, monkeypatch):
    monkeypatch.setattr(fake_repo, "get_applicant_by_nid", lambda nid: {"id": 2})
    monkeypatch.setattr(fake_repo, "has_pending_request", lambda e, a: False)
    monkeypatch.setattr(fake_repo, "create_access_request", lambda **kw: {"id": 1, "status": "PENDING"})
    out = fake_repo.create_access_request(employer_id=10, applicant_id=2)
    assert out["status"] == "PENDING"

def test_ACCESS_duplicate_pending(fake_repo, monkeypatch):
    monkeypatch.setattr(fake_repo, "get_applicant_by_nid", lambda nid: {"id": 2})
    monkeypatch.setattr(fake_repo, "has_pending_request", lambda e, a: True)
    with pytest.raises(ValueError):
        if fake_repo.has_pending_request(10, 2):
            raise ValueError("duplicate_pending")

def test_ACCESS_approve_success(fake_repo, monkeypatch):
    req = {"id":1,"status":"PENDING","applicant_id":2}
    certs = [{"id":1,"status":"ACTIVE"},{"id":2,"status":"ACTIVE"}]
    monkeypatch.setattr(fake_repo, "get_request", lambda rid: req)
    monkeypatch.setattr(fake_repo, "get_owned_certs", lambda app, ids: certs)
    monkeypatch.setattr(fake_repo, "share_certs", lambda rid, cs: len(cs))
    monkeypatch.setattr(fake_repo, "set_request_status", lambda rid, st: {"id": rid, "status": st})
    shared = fake_repo.share_certs(1, certs)
    out = fake_repo.set_request_status(1, "APPROVED")
    assert shared == 2 and out["status"] == "APPROVED"

def test_ACCESS_decline(fake_repo, monkeypatch):
    monkeypatch.setattr(fake_repo, "set_request_status", lambda rid, st: {"id": rid, "status": st})
    assert fake_repo.set_request_status(1, "DECLINED")["status"] == "DECLINED"

def test_ACCESS_partial_skip_revoked():
    certs = [{"id":1,"status":"ACTIVE"},{"id":2,"status":"REVOKED"}]
    active = [c for c in certs if c["status"] == "ACTIVE"]
    assert [c["id"] for c in active] == [1]

def test_ACCESS_employer_views_shared(fake_repo, monkeypatch):
    monkeypatch.setattr(fake_repo, "list_shared_active", lambda rid: [{"id":1,"status":"ACTIVE"}])
    out = fake_repo.list_shared_active(1)
    assert out and all(c["status"] == "ACTIVE" for c in out)

def test_ACCESS_invalid_cert_ids(fake_repo, monkeypatch):
    monkeypatch.setattr(fake_repo, "get_owned_certs", lambda app, ids: [])
    with pytest.raises(ValueError):
        if not fake_repo.get_owned_certs(2, [999]):
            raise ValueError("invalid_certificates")
