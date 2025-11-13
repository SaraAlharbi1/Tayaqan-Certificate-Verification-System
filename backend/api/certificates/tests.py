from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.core.files.uploadedfile import SimpleUploadedFile
from unittest.mock import patch

from django.contrib.auth import get_user_model
from api.accounts.models import Institution, Applicant
from api.certificates.models import Certificate

User = get_user_model()

ISSUE_URL_NAME = "institution-certificates-issue"
LIST_URL_NAME = "institution-certificates-list"
DETAIL_URL_NAME = "institution-certificates-detail"
REVOKE_URL_NAME = "institution-certificates-revoke"


class CertificatesAPITests(APITestCase):
    def setUp(self):
        # Institution user
        self.inst_user = User.objects.create_user(
            email="issuer@uni.test",
            password="pass12345",
            role=getattr(User.Roles, "INSTITUTION", "INSTITUTION"),
        )
        self.institution = Institution.objects.create(
            user=self.inst_user,
            institution_name="Test University",
            status=getattr(Institution.Status, "APPROVED", "APPROVED"),
        )

        # Another institution
        self.other_user = User.objects.create_user(
            email="other@uni.test",
            password="pass12345",
            role=getattr(User.Roles, "INSTITUTION", "INSTITUTION"),
        )
        self.other_inst = Institution.objects.create(
            user=self.other_user,
            institution_name="Other University",
            status=getattr(Institution.Status, "APPROVED", "APPROVED"),
        )

        # Applicant
        self.applicant = Applicant.objects.create(
            user=User.objects.create_user(
                email="applicant@test.com",
                password="pass12345",
                role=getattr(User.Roles, "APPLICANT", "APPLICANT"),
            ),
            full_name="Alice Applicant",
            national_id_plain="1118997673",
            national_id_hash="0x" + "ab" * 32,
            phone="0511111111",
        )

        self.client = APIClient()
        self.client.force_authenticate(self.inst_user)

        self.issue_url = reverse(ISSUE_URL_NAME)
        self.list_url = reverse(LIST_URL_NAME)
        self.pdf_bytes = b"%PDF-1.4 test file\n%%EOF\n"

    def _file(self, name="doc.pdf", content=None):
        return SimpleUploadedFile(name, content or self.pdf_bytes, content_type="application/pdf")

    # ---------- Happy path ----------

    @patch("subprocess.check_output")
    def test_issue_success(self, mock_check_output):
        mock_check_output.side_effect = [
            b'{"cid":"bafyretestcid"}',        # Storacha upload
            b'{"tx":"0xdeadbeef","block":123}' # On-chain issue
        ]
        data = {
            "applicant_id": str(self.applicant.id),
            "display_label": "Transcript 2025",
            "issued_on": "2025-10-03",
            "file": self._file(),
        }
        res = self.client.post(self.issue_url, data, format="multipart")
        self.assertEqual(res.status_code, 200)
        self.assertIn("cid_blob", res.data)
        self.assertIn("tx_hash", res.data)

        cert = Certificate.objects.first()
        self.assertEqual(cert.tx_hash, "0xdeadbeef")
        self.assertEqual(cert.block_number, 123)
        self.assertEqual(cert.status, "ISSUED_ONCHAIN")

    # ---------- Validation & permissions ----------

    def test_issue_requires_file_and_applicant(self):
        res1 = self.client.post(self.issue_url, {"file": self._file()}, format="multipart")
        self.assertEqual(res1.status_code, 400)
        res2 = self.client.post(self.issue_url, {"applicant_id": str(self.applicant.id)}, format="multipart")
        self.assertEqual(res2.status_code, 400)

    @patch("subprocess.check_output")
    def test_issue_rejects_if_institution_not_approved(self, mock_check_output):
        self.institution.status = getattr(Institution.Status, "PENDING", "PENDING")
        self.institution.save(update_fields=["status"])
        res = self.client.post(
            self.issue_url, {"applicant_id": str(self.applicant.id), "file": self._file()}, format="multipart"
        )
        self.assertEqual(res.status_code, 403)
        self.assertEqual(Certificate.objects.count(), 0)
        mock_check_output.assert_not_called()

    @patch("subprocess.check_output")
    def test_issue_duplicate_filehash_same_institution(self, mock_check_output):
        """
        Must use a FRESH SimpleUploadedFile for the second POST.
        Reusing the same object would produce an empty read on the 2nd call.
        """
        mock_check_output.side_effect = [
            b'{"cid":"bafy1"}', b'{"tx":"0xaaa","block":10}',
            b'{"cid":"bafy2"}', b'{"tx":"0xbbb","block":11}',
        ]

        # First request
        r1 = self.client.post(self.issue_url, {"applicant_id": str(self.applicant.id), "file": self._file()}, format="multipart")
        self.assertEqual(r1.status_code, 200)
        self.assertEqual(Certificate.objects.count(), 1)

        # Second request with the SAME BYTES but a NEW file object
        r2 = self.client.post(self.issue_url, {"applicant_id": str(self.applicant.id), "file": self._file()}, format="multipart")

        # Expect app-level precheck (or DB constraint) to return 409
        self.assertEqual(r2.status_code, 409)
        self.assertEqual(Certificate.objects.count(), 1)

    # ---------- List & detail ----------

    def test_list_only_returns_own_institution_rows(self):
        c1 = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            created_by_user=self.inst_user,
            file_hash="0x" + "11"*32,
            cid_blob="bafyA",
            enc_nonce="aa",
            enc_tag="bb",
            enc_key_protected="cc",
            display_label="My Cert",
            status="ISSUED_ONCHAIN"
        )
        # foreign cert
        Certificate.objects.create(
            institution=self.other_inst,
            applicant=self.applicant,
            created_by_user=self.other_user,
            file_hash="0x" + "22"*32,
            cid_blob="bafyB",
            enc_nonce="aa",
            enc_tag="bb",
            enc_key_protected="cc",
            display_label="Other Cert",
            status="ISSUED_ONCHAIN"
        )
        res = self.client.get(self.list_url)
        self.assertEqual(res.status_code, 200)
        self.assertIn("results", res.data)
        self.assertEqual(res.data["count"], 1)
        self.assertEqual(res.data["results"][0]["id"], c1.id)

    def test_retrieve_scoped(self):
        cert = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            created_by_user=self.inst_user,
            file_hash="0x" + "33"*32,
            cid_blob="bafyC",
            enc_nonce="aa",
            enc_tag="bb",
            enc_key_protected="cc",
            display_label="Detail Cert",
            status="ISSUED_ONCHAIN"
        )
        url = reverse(DETAIL_URL_NAME, kwargs={"pk": cert.id})
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["id"], cert.id)

        # other institution's cert â†’ 404
        other_cert = Certificate.objects.create(
            institution=self.other_inst,
            applicant=self.applicant,
            created_by_user=self.other_user,
            file_hash="0x" + "44"*32,
            cid_blob="bafyD",
            enc_nonce="aa",
            enc_tag="bb",
            enc_key_protected="cc",
            display_label="Foreign",
            status="ISSUED_ONCHAIN"
        )
        url2 = reverse(DETAIL_URL_NAME, kwargs={"pk": other_cert.id})
        res2 = self.client.get(url2)
        self.assertEqual(res2.status_code, 404)

    def test_list_filters_and_search(self):
        c_ok = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            created_by_user=self.inst_user,
            file_hash="0x" + "55"*32,
            cid_blob="bafyE",
            enc_nonce="aa",
            enc_tag="bb",
            enc_key_protected="cc",
            display_label="Transcript Summer",
            status="ISSUED_ONCHAIN"
        )
        Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            created_by_user=self.inst_user,
            file_hash="0x" + "56"*32,
            cid_blob="bafyF",
            enc_nonce="aa",
            enc_tag="bb",
            enc_key_protected="cc",
            display_label="Transcript Old",
            status="REVOKED"
        )

        # default excludes revoked
        res = self.client.get(self.list_url)
        self.assertEqual(res.data["count"], 1)

        # filter by status
        res2 = self.client.get(self.list_url + "?status=REVOKED")
        self.assertEqual(res2.data["count"], 1)
        self.assertEqual(res2.data["results"][0]["status"], "REVOKED")

        # search by file_hash
        res3 = self.client.get(self.list_url + f"?search={c_ok.file_hash}")
        self.assertEqual(res3.data["count"], 1)

        # search by label
        res4 = self.client.get(self.list_url + "?search=Summer")
        self.assertEqual(res4.data["count"], 1)

    def test_ordering(self):
        c1 = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            created_by_user=self.inst_user,
            file_hash="0x" + "60"*32,
            cid_blob="bafy60",
            enc_nonce="aa",
            enc_tag="bb",
            enc_key_protected="cc",
            display_label="Older",
            status="ISSUED_ONCHAIN",
            issued_on="2025-01-01"
        )
        c2 = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            created_by_user=self.inst_user,
            file_hash="0x" + "61"*32,
            cid_blob="bafy61",
            enc_nonce="aa",
            enc_tag="bb",
            enc_key_protected="cc",
            display_label="Newer",
            status="ISSUED_ONCHAIN",
            issued_on="2025-10-03"
        )
        res = self.client.get(self.list_url + "?ordering=-issued_on")
        self.assertEqual(res.data["results"][0]["id"], c2.id)
        self.assertEqual(res.data["results"][1]["id"], c1.id)

    # ---------- Revoke (with on-chain helper) ----------

    @patch("subprocess.check_output")
    def test_revoke_success(self, mock_check_output):
        # The revoke view will call the helper ONCE (no upload/issue here)
        mock_check_output.return_value = b'{"tx":"0xrevoked","block":321}'

        cert = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            created_by_user=self.inst_user,
            file_hash="0x" + "aa"*32,
            cid_blob="bafyAA",
            enc_nonce="aa",
            enc_tag="bb",
            enc_key_protected="cc",
            display_label="To Revoke",
            status="ISSUED_ONCHAIN",
        )
        url = reverse(REVOKE_URL_NAME, kwargs={"pk": cert.id})
        res = self.client.post(url, {})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["status"], "REVOKED")

        cert.refresh_from_db()
        self.assertEqual(cert.status, "REVOKED")
        self.assertEqual(cert.revoke_tx_hash, "0xrevoked")
        self.assertEqual(cert.revoke_block_number, 321)
        mock_check_output.assert_called_once()

        # default list excludes revoked
        res_list = self.client.get(self.list_url)
        self.assertEqual(res_list.data["count"], 0)

    @patch("subprocess.check_output")
    def test_revoke_idempotent(self, mock_check_output):
        # If already revoked, view should NOT call subprocess
        cert = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            created_by_user=self.inst_user,
            file_hash="0x" + "bb"*32,
            cid_blob="bafyBB",
            enc_nonce="aa",
            enc_tag="bb",
            enc_key_protected="cc",
            display_label="Already Revoked",
            status="REVOKED",
        )
        url = reverse(REVOKE_URL_NAME, kwargs={"pk": cert.id})
        res = self.client.post(url, {})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["status"], "REVOKED")
        mock_check_output.assert_not_called()

    @patch("subprocess.check_output")
    def test_revoke_scoped_404(self, mock_check_output):
        # other institution's cert â†’ 404 and no subprocess call
        cert = Certificate.objects.create(
            institution=self.other_inst,
            applicant=self.applicant,
            created_by_user=self.other_user,
            file_hash="0x" + "cc"*32,
            cid_blob="bafyCC",
            enc_nonce="aa",
            enc_tag="bb",
            enc_key_protected="cc",
            display_label="Foreign",
            status="ISSUED_ONCHAIN",
        )
        url = reverse(REVOKE_URL_NAME, kwargs={"pk": cert.id})
        res = self.client.post(url, {})
        self.assertEqual(res.status_code, 404)
        mock_check_output.assert_not_called()

    @patch("subprocess.check_output", side_effect=Exception("boom"))
    def test_revoke_onchain_failure_500(self, mock_check_output):
        # If the helper fails, the API should return 500 and NOT flip status
        cert = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            created_by_user=self.inst_user,
            file_hash="0x" + "dd"*32,
            cid_blob="bafyDD",
            enc_nonce="aa",
            enc_tag="bb",
            enc_key_protected="cc",
            display_label="Fail Revoke",
            status="ISSUED_ONCHAIN",
        )
        url = reverse(REVOKE_URL_NAME, kwargs={"pk": cert.id})
        res = self.client.post(url, {})
        self.assertEqual(res.status_code, 500)

        cert.refresh_from_db()
        self.assertEqual(cert.status, "ISSUED_ONCHAIN")  # unchanged
        self.assertIsNone(cert.revoke_tx_hash)
        self.assertIsNone(cert.revoke_block_number)

    # ---------- Unauthenticated (401) ----------

    def test_list_requires_authentication(self):
        self.client.force_authenticate(None)  # log out
        res = self.client.get(self.list_url)
        self.assertEqual(res.status_code, 401)

    def test_issue_requires_authentication(self):
        self.client.force_authenticate(None)  # log out
        data = {"applicant_id": str(self.applicant.id), "file": self._file()}
        res = self.client.post(self.issue_url, data, format="multipart")
        self.assertEqual(res.status_code, 401)

    def test_detail_requires_authentication(self):
        cert = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            created_by_user=self.inst_user,
            file_hash="0x" + "77"*32,
            cid_blob="bafy77",
            enc_nonce="aa",
            enc_tag="bb",
            enc_key_protected="cc",
            display_label="Detail Cert",
            status="ISSUED_ONCHAIN"
        )
        self.client.force_authenticate(None)  # log out
        url = reverse(DETAIL_URL_NAME, kwargs={"pk": cert.id})
        res = self.client.get(url)
        self.assertEqual(res.status_code, 401)

