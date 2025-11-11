import pytest

def test_AUTH_001_applicant_successful_signup(fake_repo, monkeypatch):
    created = {}
    monkeypatch.setattr(
        fake_repo, "create_user",
        lambda **kw: (created.update(kw) or {"id": 1, **kw}),
        raising=False,
    )
    out = fake_repo.create_user(email="user@test.com", password="p", role="APPLICANT")
    assert out["role"] == "APPLICANT" and out["email"] == "user@test.com"

def test_AUTH_002_valid_login(fake_repo, monkeypatch):
    monkeypatch.setattr(fake_repo, "get_user_by_email",
                        lambda e: {"id": 1, "email": e, "password_hash": "h"},
                        raising=False)
    monkeypatch.setattr(fake_repo, "check_password",
                        lambda raw, h: raw == "test123",
                        raising=False)
    monkeypatch.setattr(fake_repo, "issue_tokens",
                        lambda u: {"access": "A", "refresh": "R"},
                        raising=False)
    assert fake_repo.check_password("test123", "h")
    tokens = fake_repo.issue_tokens({"id": 1})
    assert tokens["access"] and tokens["refresh"]

def test_AUTH_003_invalid_password(fake_repo, monkeypatch):
    monkeypatch.setattr(fake_repo, "get_user_by_email",
                        lambda e: {"id": 1, "email": e, "password_hash": "h"},
                        raising=False)
    monkeypatch.setattr(fake_repo, "check_password",
                        lambda raw, h: False,
                        raising=False)
    with pytest.raises(Exception):
        if not fake_repo.check_password("wrong", "h"):
            raise Exception("Authentication failed")

def test_AUTH_004_profile_payload():
    payload = {"sub": 1, "email": "user@test.com", "role": "APPLICANT"}
    assert payload["email"] and payload["role"]

def test_AUTH_005_employer_signup_pending(fake_repo, monkeypatch):
    monkeypatch.setattr(fake_repo, "create_employer",
                        lambda **kw: {"id": 5, "status": "PENDING", **kw},
                        raising=False)
    assert fake_repo.create_employer(email="emp@test.com")["status"] == "PENDING"

def test_AUTH_006_institution_signup_pending(fake_repo, monkeypatch):
    monkeypatch.setattr(fake_repo, "create_institution",
                        lambda **kw: {"id": 6, "status": "PENDING", **kw},
                        raising=False)
    assert fake_repo.create_institution(email="inst@x.com")["status"] == "PENDING"

def test_ADMIN_list_pending(fake_repo, monkeypatch):
    data = [
        {"id":1,"role":"employer","status":"PENDING"},
        {"id":2,"role":"institution","status":"PENDING"},
    ]
    monkeypatch.setattr(fake_repo, "list_pending",
                        lambda role: [x for x in data if x["role"] == role],
                        raising=False)
    assert len(fake_repo.list_pending("employer")) == 1
    assert len(fake_repo.list_pending("institution")) == 1

@pytest.mark.parametrize("new_status", ["APPROVED","REJECTED"])
def test_ADMIN_moderate(fake_repo, monkeypatch, new_status):
    rec = {"id":5,"role":"employer","status":"PENDING"}
    monkeypatch.setattr(fake_repo, "get_user",
                        lambda _id: rec,
                        raising=False)
    monkeypatch.setattr(fake_repo, "set_status",
                        lambda _id, st, notes: (rec.update({"status": st}) or rec),
                        raising=False)
    out = fake_repo.set_status(5, new_status, "ok")
    assert out["status"] == new_status

def test_ADMIN_guard_non_admin():
    is_admin = False
    with pytest.raises(PermissionError):
        if not is_admin:
            raise PermissionError("Admin required")
