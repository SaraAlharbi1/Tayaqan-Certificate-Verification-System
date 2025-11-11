# api/accounts/tests.py
import io
import os
import shutil
import tempfile

from django.urls import reverse
from django.test import override_settings, TestCase
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase, APIClient
from django.core.files.uploadedfile import SimpleUploadedFile

from api.accounts.models import Applicant, Employer, Institution

User = get_user_model()

# ------- helpers -------
def _tiny_pdf_bytes() -> bytes:
    return b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"

def _pdf_upload(name="proof.pdf", size=2048):
    base = _tiny_pdf_bytes()
    if size > len(base):
        base = base + b"\n" * (size - len(base))
    return SimpleUploadedFile(name, base, content_type="application/pdf")


# ===================== APPLICANT =====================
TEMP_MEDIA_ROOT = tempfile.mkdtemp(prefix="tayaqan_media_")

@override_settings(MEDIA_ROOT=TEMP_MEDIA_ROOT)
class ApplicantFlowsTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEMP_MEDIA_ROOT, ignore_errors=True)

    def _signup_applicant(self, **over):
        url = reverse("signup-applicant")
        payload = {
            "full_name": "Test Applicant",
            "email": over.get("email", "applicant@example.com"),
            "national_id": over.get("national_id", "1234567890"),
            "phone": over.get("phone", "+966512345678"),
            "password": over.get("password", "DevOnly123!"),
            "confirm_password": over.get("password", "DevOnly123!"),
        }
        return self.client.post(url, payload, format="json")

    def _login(self, identifier, password="DevOnly123!"):
        url = reverse("auth-login")
        resp = self.client.post(url, {"identifier": identifier, "password": password}, format="json")
        return resp.status_code, getattr(resp, "data", {})

    def test_applicant_signup_ok(self):
        resp = self._signup_applicant()
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        u = User.objects.get(email="applicant@example.com")
        self.assertEqual(u.role, "APPLICANT")
        self.assertTrue(hasattr(u, "applicant"))
        self.assertEqual(u.applicant.national_id_plain, "1234567890")

    def test_applicant_normalize_and_duplicate(self):
        # Arabic-Indic → ASCII "1234567890"
        resp1 = self._signup_applicant(email="a1@example.com", national_id=" ١٢٣-٤٥٦ ٧٨٩٠ ")
        self.assertEqual(resp1.status_code, 201)
        self.assertEqual(
            Applicant.objects.get(user__email="a1@example.com").national_id_plain, "1234567890"
        )
        # Duplicate canonical ID rejected
        resp2 = self._signup_applicant(email="a2@example.com", national_id="1234567890")
        self.assertEqual(resp2.status_code, 400)
        self.assertIn("national_id", resp2.data)

    def test_login_by_email_and_id(self):
        self._signup_applicant(email="login@example.com", national_id="1234567890")
        c1, d1 = self._login("login@example.com")
        self.assertEqual(c1, 200)
        self.assertIn("access", d1); self.assertIn("refresh", d1)
        c2, d2 = self._login("١٢٣٤٥٦٧٨٩٠")
        self.assertEqual(c2, 200)
        self.assertIn("access", d2); self.assertIn("refresh", d2)

    def test_me_returns_full_id_for_applicant(self):
        self._signup_applicant(email="me@example.com")
        _, tok = self._login("me@example.com")
        url = reverse("auth-me")
        resp = self.client.get(url, HTTP_AUTHORIZATION=f"Bearer {tok['access']}")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["email"], "me@example.com")
        self.assertEqual(resp.data["role"], "APPLICANT")
        self.assertEqual(resp.data["profile"]["national_id"], "1234567890")

    def test_me_requires_auth(self):
        url = reverse("auth-me")
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 401)


# ===================== EMPLOYER SIGNUP =====================
@override_settings(MEDIA_ROOT=tempfile.mkdtemp(prefix="tayaqan_media_emp_"))
class EmployerSignupTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(cls._overridden_settings["MEDIA_ROOT"], ignore_errors=True)

    def test_employer_signup_pdf_ok_and_pending(self):
        url = reverse("signup-employer")
        resp = self.client.post(
            url,
            data={
                "full_name": "HR Person",
                "work_email": "hr@co.com",
                "company_name": "My Co",
                "cr_number": "1234567890",
                "phone": "+966512345678",
                "password": "DevOnly123!",
                "confirm_password": "DevOnly123!",
                "proof_doc": _pdf_upload(),
            },
            format="multipart",
        )
        self.assertEqual(resp.status_code, 201)
        u = User.objects.get(email="hr@co.com")
        self.assertEqual(u.role, "EMPLOYER")
        self.assertEqual(u.employer.status, Employer.Status.PENDING)
        self.assertEqual(u.employer.cr_number_plain, "1234567890")

    def test_employer_signup_rejects_nonpdf_and_oversize(self):
        url = reverse("signup-employer")
        # non-PDF
        txt = SimpleUploadedFile("x.txt", b"hello", content_type="text/plain")
        r1 = self.client.post(
            url,
            data={
                "full_name": "HR",
                "work_email": "hr2@co.com",
                "company_name": "Co",
                "cr_number": "1111111111",
                "phone": "+9665",
                "password": "DevOnly123!",
                "confirm_password": "DevOnly123!",
                "proof_doc": txt,
            },
            format="multipart",
        )
        self.assertEqual(r1.status_code, 400)
        self.assertIn("proof_doc", r1.data)

        # >5MB
        big = _pdf_upload(size=5 * 1024 * 1024 + 1)
        r2 = self.client.post(
            url,
            data={
                "full_name": "HR",
                "work_email": "hr3@co.com",
                "company_name": "Co",
                "cr_number": "2222222222",
                "phone": "+9665",
                "password": "DevOnly123!",
                "confirm_password": "DevOnly123!",
                "proof_doc": big,
            },
            format="multipart",
        )
        self.assertEqual(r2.status_code, 400)
        self.assertIn("proof_doc", r2.data)

    def test_employer_signup_writes_file(self):
        url = reverse("signup-employer")
        pdf = io.BytesIO(_tiny_pdf_bytes()); pdf.name = "auth_letter.pdf"
        r = self.client.post(
            url,
            data={
                "full_name": "Khalid HR",
                "work_email": "hr@newcorp.com",
                "company_name": "Example Corp",
                "cr_number": "1010123456",
                "phone": "+966511111111",
                "password": "DevOnly123!",
                "confirm_password": "DevOnly123!",
                "proof_doc": pdf,
            },
            format="multipart",
        )
        self.assertEqual(r.status_code, 201, r.content)
        emp = Employer.objects.get(user__email="hr@newcorp.com")
        self.assertTrue(emp.proof_doc.name)
        self.assertTrue(os.path.exists(emp.proof_doc.path))
        self.assertTrue(emp.proof_doc.url.endswith(".pdf"))


# ===================== RULES & ADMIN =====================
class RulesAndAdminTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        # admin
        cls.admin = User.objects.create_user(
            email="admin@example.com", password="Admin#123", role=User.Roles.ADMIN, is_staff=True
        )
        # applicant
        cls.app_u = User.objects.create_user(
            email="applicant@example.com", password="Pass#1234", role=User.Roles.APPLICANT
        )
        Applicant.objects.create(
            user=cls.app_u, full_name="Aisha Applicant", national_id_plain="1234567890", phone="+966500000000"
        )
        # employer (pending)
        cls.emp_u = User.objects.create_user(
            email="emp@corp.com", password="Pass#1234", role=User.Roles.EMPLOYER
        )
        Employer.objects.create(
            user=cls.emp_u, full_name="Sara HR", company_name="Al Najm",
            cr_number_plain="1010456789", status=Employer.Status.PENDING
        )
        # institution (pending)
        cls.inst_u = User.objects.create_user(
            email="registrar@uni.edu", password="Pass#1234", role=User.Roles.INSTITUTION
        )
        Institution.objects.create(
            user=cls.inst_u, institution_name="KSU", department="Registrar",
            status=Institution.Status.PENDING
        )

    def setUp(self):
        self.c = APIClient()

    def test_applicant_can_login(self):
        r = self.c.post(reverse("auth-login"), {"identifier": "applicant@example.com", "password": "Pass#1234"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertIn("access", r.data); self.assertIn("refresh", r.data)

    def test_employer_blocked_when_pending(self):
        r = self.c.post(reverse("auth-login"), {"identifier": "emp@corp.com", "password": "Pass#1234"}, format="json")
        self.assertEqual(r.status_code, 401)
        self.assertIn("not approved", str(r.data).lower())

    def test_employer_can_login_after_approval(self):
        emp = self.emp_u.employer
        emp.status = Employer.Status.APPROVED
        emp.save()
        r = self.c.post(reverse("auth-login"), {"identifier": "emp@corp.com", "password": "Pass#1234"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertIn("access", r.data)

    def test_institution_blocked_when_pending(self):
        r = self.c.post(reverse("auth-login"), {"identifier": "registrar@uni.edu", "password": "Pass#1234"}, format="json")
        self.assertEqual(r.status_code, 401)

    def test_institution_can_login_after_approval(self):
        inst = self.inst_u.institution
        inst.status = Institution.Status.APPROVED
        inst.save()
        r = self.c.post(reverse("auth-login"), {"identifier": "registrar@uni.edu", "password": "Pass#1234"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertIn("access", r.data)

    def test_admin_list_pending_employers(self):
        # get admin token
        r = self.c.post(reverse("auth-login"), {"identifier": "admin@example.com", "password": "Admin#123"}, format="json")
        access = r.data["access"]
        url = reverse("admin-accounts-pending") + "?role=employer"
        res = self.c.get(url, HTTP_AUTHORIZATION=f"Bearer {access}")
        self.assertEqual(res.status_code, 200)
        emails = [row["email"] for row in res.data.get("results", [])]
        self.assertIn("emp@corp.com", emails)

    def test_non_admin_forbidden(self):
        self.c.force_authenticate(self.app_u)
        res = self.c.get(reverse("admin-accounts-pending") + "?role=employer")
        self.assertEqual(res.status_code, 403)

    def test_admin_can_update_status_employer(self):
        self.c.force_authenticate(self.admin)
        url = reverse("admin-accounts-status", kwargs={"pk": self.emp_u.id})
        res = self.c.patch(url, {"status": "APPROVED", "notes": "ok"}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.emp_u.refresh_from_db()
        self.assertEqual(self.emp_u.employer.status, Employer.Status.APPROVED)
