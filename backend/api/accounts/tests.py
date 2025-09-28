"""
Accounts app API tests.

What this file covers
---------------------
1) Applicant signup:
   - Accepts 10-digit national ID.
   - Normalizes Arabic-Indic digits to ASCII and drops separators.
   - Stores plain ID and allows login by ID.

2) Login:
   - Works with email and with exact (normalized) national ID.
   - Returns JWT access/refresh tokens.

3) /me:
   - Returns role-aware profile.
   - Applicant sees FULL national_id (per your policy).

4) Employer signup (multipart):
   - Accepts PDF (<=5MB), rejects non-PDF and oversize files.
   - Creates employer with status=PENDING.

5) Admin moderation:
   - Admin can list pending org accounts.
   - Admin can approve an employer.

Notes
-----
- We keep the tests close to the API contract you exposed in accounts/urls.py.
- Where needed, we use in-memory files via SimpleUploadedFile for PDF upload.
- MEDIA_ROOT is redirected to a temp folder so tests don't affect real media/.
"""

import io
import os
import shutil
import tempfile

from django.urls import reverse
from django.test import override_settings
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status
from django.core.files.uploadedfile import SimpleUploadedFile

from api.accounts.models import Applicant, Employer

User = get_user_model()

# Use a temporary media directory for uploads during tests
TEMP_MEDIA_ROOT = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=TEMP_MEDIA_ROOT)
class AccountsApplicantTests(APITestCase):
    """
    Tests around Applicant flows:
    - signup with normalization
    - login (email & ID)
    - /me returns full national_id
    """

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        # Clean up any files saved under the temp media root
        shutil.rmtree(TEMP_MEDIA_ROOT, ignore_errors=True)

    def _signup_applicant(self, full_name="Test Applicant", email="applicant@example.com",
                          national_id="1234567890", phone="+966512345678", password="DevOnly123!"):
        """
        Helper: create an applicant via the public signup endpoint.
        Returns the response object.
        """
        url = reverse("signup-applicant")
        payload = {
            "full_name": full_name,
            "email": email,
            "national_id": national_id,
            "phone": phone,
            "password": password,
            "confirm_password": password,
        }
        return self.client.post(url, payload, format="json")

    def _login(self, identifier, password="DevOnly123!"):
        """
        Helper: call /api/auth/login with identifier (email or national ID).
        Returns (status_code, data_dict).
        """
        url = reverse("auth-login")
        resp = self.client.post(url, {"identifier": identifier, "password": password}, format="json")
        return resp.status_code, getattr(resp, "data", {})

    def test_applicant_signup_success(self):
        """
        Happy path: 10-digit ASCII ID, valid email/phone/password → 201 Created.
        Also asserts DB objects exist with expected plain ID.
        """
        resp = self._signup_applicant()
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

        # Ensure user/applicant rows exist and plain ID is stored
        user = User.objects.get(email="applicant@example.com")
        self.assertEqual(user.role, "APPLICANT")
        self.assertTrue(hasattr(user, "applicant"))
        self.assertEqual(user.applicant.national_id_plain, "1234567890")
        self.assertTrue(user.applicant.national_id_hash.startswith("0x") and len(user.applicant.national_id_hash) == 66)

    def test_applicant_signup_normalizes_arabic_digits_and_rejects_duplicate(self):
        """
        The serializer should normalize Arabic-Indic digits to ASCII and strip non-digits.
        It should also reject duplicate IDs (same canonical 10-digit).
        """
        # First signup with Arabic-Indic + separators → should normalize to 1234567890
        arabic_id = " ١٢٣-٤٥٦ ٧٨٩٠ "
        resp1 = self._signup_applicant(email="a1@example.com", national_id=arabic_id)
        self.assertEqual(resp1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Applicant.objects.get(user__email="a1@example.com").national_id_plain, "1234567890")

        # Second signup with the already-normalized ASCII should be rejected as duplicate
        resp2 = self._signup_applicant(email="a2@example.com", national_id="1234567890")
        self.assertEqual(resp2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("national_id", resp2.data)

    def test_login_by_email_and_by_national_id(self):
        """
        After signup, login should work:
        - with email
        - with national ID (the serializer normalizes non-email identifiers)
        """
        self._signup_applicant(email="login@example.com", national_id="1234567890")

        # Login by email
        code_email, data_email = self._login("login@example.com")
        self.assertEqual(code_email, status.HTTP_200_OK)
        self.assertIn("access", data_email)
        self.assertIn("refresh", data_email)

        # Login by ID (Arabic-Indic input is normalized)
        code_id, data_id = self._login("١٢٣٤٥٦٧٨٩٠")
        self.assertEqual(code_id, status.HTTP_200_OK)
        self.assertIn("access", data_id)
        self.assertIn("refresh", data_id)

    def test_me_returns_full_id_for_applicant(self):
        """
        /api/me should return full national_id for Applicant (per product policy).
        """
        self._signup_applicant(email="me@example.com", national_id="1234567890")
        # Get token
        _, tokens = self._login("me@example.com")
        access = tokens["access"]

        # Call /me with Authorization header
        url = reverse("me")
        resp = self.client.get(url, HTTP_AUTHORIZATION=f"Bearer {access}")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        self.assertEqual(resp.data["email"], "me@example.com")
        self.assertEqual(resp.data["role"], "APPLICANT")
        self.assertIn("profile", resp.data)
        self.assertEqual(resp.data["profile"]["national_id"], "1234567890")


@override_settings(MEDIA_ROOT=TEMP_MEDIA_ROOT)
class AccountsEmployerTests(APITestCase):
    """
    Tests around Employer signup (multipart PDF) and status semantics.
    """

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEMP_MEDIA_ROOT, ignore_errors=True)

    def _pdf_file(self, name="proof.pdf", size_bytes=2048):
        """
        Create a minimal in-memory PDF file with the correct content_type.
        """
        fake_pdf_bytes = b"%PDF-1.4\n%Minimal\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
        # pad to requested size
        if size_bytes > len(fake_pdf_bytes):
            fake_pdf_bytes = fake_pdf_bytes + b"\n" * (size_bytes - len(fake_pdf_bytes))
        return SimpleUploadedFile(name, fake_pdf_bytes, content_type="application/pdf")

    def _signup_employer(self, work_email="hr@co.com", cr_number="1234567890", pdf=None, password="DevOnly123!"):
        """
        Helper: create an employer via the public signup endpoint (multipart).
        """
        url = reverse("signup-employer")
        file_obj = pdf or self._pdf_file()
        data = {
            "full_name": "HR Person",
            "work_email": work_email,
            "company_name": "My Co",
            "cr_number": cr_number,
            "phone": "+966512345678",
            "password": password,
            "confirm_password": password,
            "proof_doc": file_obj,
        }
        return self.client.post(url, data, format="multipart")

    def test_employer_signup_pdf_ok_and_status_pending(self):
        """
        Employer signup succeeds with a proper PDF and sets status=PENDING.
        """
        resp = self._signup_employer()
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email="hr@co.com")
        self.assertEqual(user.role, "EMPLOYER")
        self.assertTrue(hasattr(user, "employer"))
        self.assertEqual(user.employer.status, Employer.Status.PENDING)
        # CR number normalization (digits only) should store as provided (already digits)
        self.assertEqual(user.employer.cr_number_plain, "1234567890")
        self.assertTrue(user.employer.verifier_id_hash.startswith("0x"))

    def test_employer_signup_rejects_non_pdf_and_oversize_pdf(self):
        """
        - Reject non-PDF content types.
        - Reject PDFs larger than 5 MB.
        """
        # Non-PDF
        txt = SimpleUploadedFile("note.txt", b"hello", content_type="text/plain")
        resp_bad_type = self._signup_employer(work_email="hr2@co.com", pdf=txt)
        self.assertEqual(resp_bad_type.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("proof_doc", resp_bad_type.data)

        # Oversize PDF (> 5 MB)
        big_pdf = self._pdf_file(size_bytes=(5 * 1024 * 1024 + 1))
        resp_big = self._signup_employer(work_email="hr3@co.com", pdf=big_pdf)
        self.assertEqual(resp_big.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("proof_doc", resp_big.data)


class AccountsAdminTests(APITestCase):
    """
    Tests for admin-only endpoints:
    - list pending employers
    - approve employer
    """

    def setUp(self):
        """
        Create an admin (superuser) and an example pending employer.
        """
        self.admin = User.objects.create_superuser(email="admin@example.com", password="AdminDev123!")
        # Create a pending employer through the model to focus on admin endpoints here
        u = User.objects.create_user(email="pending@co.com", password="DevOnly123!", role="EMPLOYER")
        self.emp = Employer.objects.create(
            user=u,
            full_name="Pending HR",
            work_email="pending@co.com",
            company_name="Pending Co",
            cr_number_plain="2222222222",
            verifier_id_hash="0x" + "2" * 64,
            status=Employer.Status.PENDING,
        )

        # Login as admin to get a JWT
        url = reverse("auth-login")
        resp = self.client.post(url, {"identifier": "admin@example.com", "password": "AdminDev123!"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.admin_access = resp.data["access"]

    def test_admin_list_pending_employers(self):
        """
        GET /api/admin/accounts/pending?role=employer should list PENDING employers.
        """
        url = reverse("admin-pending") + "?role=employer"
        resp = self.client.get(url, HTTP_AUTHORIZATION=f"Bearer {self.admin_access}")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("results", resp.data)
        emails = [row["email"] for row in resp.data["results"]]
        self.assertIn("pending@co.com", emails)

    def test_admin_approve_employer(self):
        """
        PATCH /api/admin/accounts/<user_id>/status should change status to APPROVED.
        """
        url = reverse("admin-update-status", kwargs={"user_id": self.emp.user.id})
        resp = self.client.patch(
            url,
            {"status": "APPROVED", "notes": "Looks good"},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.admin_access}",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # Refresh from DB and check status
        self.emp.refresh_from_db()
        self.assertEqual(self.emp.status, Employer.Status.APPROVED)
