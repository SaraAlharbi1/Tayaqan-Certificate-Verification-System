"""
Minimal Integration Tests for Accounts App
"""

from unittest.mock import patch
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.core.files.uploadedfile import SimpleUploadedFile

from api.accounts.models import User, Applicant, Employer, Institution
from api.accounts.utils import keccak256_hex


class SignupTest(TestCase):
    """Test user registration."""

    def setUp(self):
        self.client = APIClient()

    def test_applicant_signup(self):
        """Should create applicant account."""
        data = {
            "email": "applicant@test.com",
            "password": "SecurePass123",
            "confirm_password": "SecurePass123",
            "full_name": "Ahmed Ali",
            "national_id": "1234567890",
            "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb5",
            "phone": "+966501234567",
        }

        response = self.client.post("/api/accounts/signup/applicant/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(email="applicant@test.com")
        self.assertEqual(user.role, User.Roles.APPLICANT)
        
        applicant = Applicant.objects.get(user=user)
        self.assertEqual(applicant.full_name, "Ahmed Ali")

    def test_employer_signup(self):
        """Should create employer with PENDING status."""
        proof_file = SimpleUploadedFile(
            "proof.pdf", b"fake pdf content", content_type="application/pdf"
        )

        data = {
            "email": "employer@company.com",
            "password": "SecurePass123",
            "confirm_password": "SecurePass123",
            "full_name": "HR Manager",
            "company_name": "Tech Corp",
            "official_email": "hr@techcorp.com",
            "phone": "+966501234567",
            "proof_doc": proof_file,
        }

        response = self.client.post(
            "/api/accounts/signup/employer/", data, format="multipart"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "PENDING")


class AuthenticationTest(TestCase):
    """Test login and profile retrieval."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="user@test.com", password="Pass123", role=User.Roles.APPLICANT
        )
        Applicant.objects.create(
            user=self.user,
            full_name="Test User",
            national_id_plain="1234567890",
            national_id_hash=keccak256_hex("1234567890"),
            wallet_address="0x" + "1" * 40,
        )

    def test_login_with_email(self):
        """Should login with email and password."""
        response = self.client.post(
            "/api/accounts/auth/login/",
            {"identifier": "user@test.com", "password": "Pass123"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_login_with_national_id(self):
        """Should login with national ID."""
        response = self.client.post(
            "/api/accounts/auth/login/",
            {"identifier": "1234567890", "password": "Pass123"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)

    def test_me_endpoint(self):
        """Should return user profile."""
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/accounts/auth/me/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["role"], "APPLICANT")


class AdminApprovalTest(TestCase):
    """Test admin approval workflow."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            email="admin@test.com", password="AdminPass123"
        )
        self.client.force_authenticate(user=self.admin)

    @patch("api.accounts.views.employer_approved")
    def test_approve_employer(self, mock_event):
        """Should approve employer and trigger event."""
        emp_user = User.objects.create_user(
            email="emp@test.com", password="Pass123", role=User.Roles.EMPLOYER
        )
        employer = Employer.objects.create(
            user=emp_user,
            full_name="Test Employer",
            company_name="Test Corp",
            official_email="info@test.com",
            status=Employer.Status.PENDING,
        )

        response = self.client.patch(
            f"/api/accounts/admin/accounts/{emp_user.id}/status/",
            {"status": "APPROVED"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        employer.refresh_from_db()
        self.assertEqual(employer.status, Employer.Status.APPROVED)
        mock_event.assert_called_once()

    @patch("api.accounts.views.institution_approved")
    def test_approve_institution(self, mock_event):
        """Should approve institution."""
        inst_user = User.objects.create_user(
            email="inst@test.com", password="Pass123", role=User.Roles.INSTITUTION
        )
        institution = Institution.objects.create(
            user=inst_user,
            institution_name="Test University",
            official_email="info@test.edu",
            wallet_address="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb5",
            status=Institution.Status.PENDING,
        )

        response = self.client.patch(
            f"/api/accounts/admin/accounts/{inst_user.id}/status/",
            {"status": "APPROVED"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        institution.refresh_from_db()
        self.assertEqual(institution.status, Institution.Status.APPROVED)
        mock_event.assert_called_once()


class VerifyApplicantTest(TestCase):
    """Test applicant verification endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="employer@test.com", password="Pass123", role=User.Roles.EMPLOYER
        )
        self.client.force_authenticate(user=self.user)

    def test_verify_applicant(self):
        """Should verify applicant by national ID."""
        user = User.objects.create_user(
            email="applicant@test.com", password="Pass123", role=User.Roles.APPLICANT
        )
        Applicant.objects.create(
            user=user,
            full_name="Ahmed Ali",
            national_id_plain="1234567890",
            national_id_hash=keccak256_hex("1234567890"),
            wallet_address="0x" + "1" * 40,
        )

        response = self.client.get("/api/accounts/applicants/verify/1234567890/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["full_name"], "Ahmed Ali")

    def test_verify_applicant_not_found(self):
        """Should return 404 when applicant not found."""
        response = self.client.get("/api/accounts/applicants/verify/9999999999/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)