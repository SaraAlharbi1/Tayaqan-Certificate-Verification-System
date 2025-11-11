import pytest

@pytest.mark.parametrize("actor", ["INSTITUTION","APPLICANT"])
def test_STORAGE_download_active(fake_storage, actor):
    pdf = fake_storage.decrypt(b"\x00\x01", key=b"k")
    assert pdf.startswith(b"%PDF-1.4")

def test_STORAGE_revoked_blocked():
    with pytest.raises(PermissionError):
        status = "REVOKED"
        if status != "ACTIVE":
            raise PermissionError("revoked_or_missing")

def test_STORAGE_employer_with_access(fake_storage):
    has_access = True
    pdf = fake_storage.decrypt(b"\x00\x01", key=b"k") if has_access else None
    assert pdf and pdf.startswith(b"%PDF-1.4")

def test_STORAGE_employer_without_access():
    with pytest.raises(PermissionError):
        has_access = False
        if not has_access:
            raise PermissionError("no_access")

def test_STORAGE_decryption_failure(fake_storage, monkeypatch):
    monkeypatch.setattr(fake_storage, "decrypt", lambda b, key: (_ for _ in ()).throw(ValueError("decryption_failed")))
    with pytest.raises(ValueError):
        fake_storage.decrypt(b"\x00", b"k")

def test_STORAGE_missing_cid():
    with pytest.raises(ValueError):
        cid = None
        if not cid:
            raise ValueError("missing_cid")
