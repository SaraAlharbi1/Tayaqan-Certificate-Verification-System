"""Integration tests for Accounts app."""

import pytest
from unittest.mock import patch, MagicMock
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from api.accounts.models import User, Applicant, Employer, Institution


# ============================================================
# Signup Flow Tests
# ============================================================

@pytest.mark.django_db
class TestApplicantSignupFlow:
    """Test applicant signup and login flow."""

    def test_applicant_signup_and_login(self):
        client = APIClient()
        
        # Signup
        signup_data = {
            "full_name": "Ahmad Ali",
            "email": "ahmad@test.com",
            "national_id": "1234567890",
            "wallet_address": "0x1234567890123456789012345678901234567890",
            "password": "Test1234",
            "confirm_password": "Test1234"
        }
        response = client.post("/api/accounts/signup/applicant/", signup_data)
        assert response.status_code == 201
        
        # Verify user created
        user = User.objects.get(email="ahmad@test.com")
        assert user.role == User.Roles.APPLICANT
        assert hasattr(user, "applicant")
        
        # Login with email
        login_data = {"identifier": "ahmad@test.com", "password": "Test1234"}
        response = client.post("/api/accounts/auth/login/", login_data)
        assert response.status_code == 200
        assert "access" in response.data
        
        # Login with national ID
        login_data = {"identifier": "1234567890", "password": "Test1234"}
        response = client.post("/api/accounts/auth/login/", login_data)
        assert response.status_code == 200


@pytest.mark.django_db
class TestEmployerSignupFlow:
    """Test employer signup flow."""

    def test_employer_signup_pending(self):
        client = APIClient()
        
        pdf_file = SimpleUploadedFile("proof.pdf", b"fake pdf", content_type="application/pdf")
        
        signup_data = {
            "full_name": "John Doe",
            "official_email": "john@company.com",
            "company_name": "Test Corp",
            "password": "Test1234",
            "confirm_password": "Test1234",
            "proof_doc": pdf_file
        }
        response = client.post("/api/accounts/signup/employer/", signup_data, format='multipart')
        assert response.status_code == 201
        assert response.data["status"] == "PENDING"
        
        # Cannot login while pending
        login_data = {"identifier": "john@company.com", "password": "Test1234"}
        response = client.post("/api/accounts/auth/login/", login_data)
        assert response.status_code == 401


@pytest.mark.django_db
class TestInstitutionSignupFlow:
    """Test institution signup flow."""

    def test_institution_signup_pending(self):
        client = APIClient()
        
        pdf_file = SimpleUploadedFile("proof.pdf", b"fake pdf", content_type="application/pdf")
        
        signup_data = {
            "institution_name": "Test University",
            "official_email": "info@uni.edu",
            "wallet_address": "0x1234567890123456789012345678901234567890",
            "password": "Test1234",
            "confirm_password": "Test1234",
            "proof_doc": pdf_file
        }
        response = client.post("/api/accounts/signup/institution/", signup_data, format='multipart')
        assert response.status_code == 201
        
        # Verify institution created
        institution = Institution.objects.get(official_email="info@uni.edu")
        assert institution.status == Institution.Status.PENDING
        assert institution.contract_address is None


# ============================================================
# Admin Operations Tests
# ============================================================

@pytest.mark.django_db
class TestAdminApprovalFlow:
    """Test admin approval workflow."""

    def test_admin_list_pending_employers(self):
        admin = User.objects.create_superuser(email="admin@test.com", password="admin")
        
        employer_user = User.objects.create_user(
            email="emp@test.com",
            password="pass",
            role=User.Roles.EMPLOYER
        )
        Employer.objects.create(
            user=employer_user,
            full_name="Test",
            company_name="Test Corp",
            official_email="emp@test.com"
        )
        
        client = APIClient()
        client.force_authenticate(user=admin)
        response = client.get("/api/accounts/admin/accounts/pending/?role=employer")
        
        assert response.status_code == 200
        assert len(response.data["results"]) == 1
        assert response.data["results"][0]["company_name"] == "Test Corp"

    def test_admin_approve_employer(self):
        admin = User.objects.create_superuser(email="admin@test.com", password="admin")
        
        employer_user = User.objects.create_user(
            email="emp@test.com",
            password="pass",
            role=User.Roles.EMPLOYER
        )
        employer = Employer.objects.create(
            user=employer_user,
            full_name="Test",
            company_name="Test Corp",
            official_email="emp@test.com"
        )
        
        client = APIClient()
        client.force_authenticate(user=admin)
        response = client.patch(
            f"/api/accounts/admin/accounts/{employer_user.id}/status/",
            {"status": "APPROVED"}
        )
        
        assert response.status_code == 200
        employer.refresh_from_db()
        assert employer.status == Employer.Status.APPROVED

    @patch('api.accounts.events._deploy_certificate_registry')
    @patch('api.accounts.events._register_in_institution_registry')
    def test_admin_approve_institution_triggers_deployment(
        self, 
        mock_register, 
        mock_deploy
    ):
        """Test institution approval triggers blockchain deployment."""
        # Mock blockchain calls
        mock_deploy.return_value = "0x1234567890123456789012345678901234567890"
        mock_register.return_value = True
        
        admin = User.objects.create_superuser(email="admin@test.com", password="admin")
        
        institution_user = User.objects.create_user(
            email="uni@test.com",
            password="pass",
            role=User.Roles.INSTITUTION
        )
        institution = Institution.objects.create(
            user=institution_user,
            institution_name="Test University",
            official_email="uni@test.com",
            wallet_address="0x1111111111111111111111111111111111111111"
        )
        
        client = APIClient()
        client.force_authenticate(user=admin)
        response = client.patch(
            f"/api/accounts/admin/accounts/{institution_user.id}/status/",
            {"status": "APPROVED"}
        )
        
        assert response.status_code == 200
        institution.refresh_from_db()
        assert institution.status == Institution.Status.APPROVED
        assert institution.institution_id is not None
        assert institution.contract_address == "0x1234567890123456789012345678901234567890"
        
        # Verify blockchain functions were called
        mock_deploy.assert_called_once()
        mock_register.assert_called_once()


# ============================================================
# Authentication Tests
# ============================================================

@pytest.mark.django_db
class TestAuthenticationFlow:
    """Test authentication flows."""

    def test_login_returns_tokens(self):
        User.objects.create_user(email="test@test.com", password="Test1234")
        
        client = APIClient()
        response = client.post("/api/accounts/auth/login/", {
            "identifier": "test@test.com",
            "password": "Test1234"
        })
        
        assert response.status_code == 200
        assert "access" in response.data
        assert "refresh" in response.data
        assert "user" in response.data

    def test_refresh_token_works(self):
        User.objects.create_user(email="test@test.com", password="Test1234")
        
        client = APIClient()
        login_response = client.post("/api/accounts/auth/login/", {
            "identifier": "test@test.com",
            "password": "Test1234"
        })
        
        refresh_token = login_response.data["refresh"]
        
        refresh_response = client.post("/api/accounts/auth/refresh/", {
            "refresh": refresh_token
        })
        
        assert refresh_response.status_code == 200
        assert "access" in refresh_response.data

    def test_me_endpoint_returns_profile(self):
        user = User.objects.create_user(email="test@test.com", password="Test1234")
        Applicant.objects.create(
            user=user,
            full_name="Ahmad Ali",
            national_id_plain="1234567890",
            national_id_hash="0xabc",
            wallet_address="0x1234567890123456789012345678901234567890"
        )
        
        client = APIClient()
        client.force_authenticate(user=user)
        
        response = client.get("/api/accounts/auth/me/")
        
        assert response.status_code == 200
        assert response.data["email"] == "test@test.com"
        assert response.data["role"] == "APPLICANT"
        assert response.data["profile"]["full_name"] == "Ahmad Ali"

    def test_unapproved_employer_cannot_login(self):
        user = User.objects.create_user(
            email="emp@test.com",
            password="Test1234",
            role=User.Roles.EMPLOYER
        )
        Employer.objects.create(
            user=user,
            full_name="Test",
            company_name="Test Corp",
            official_email="emp@test.com",
            status=Employer.Status.PENDING
        )
        
        client = APIClient()
        response = client.post("/api/accounts/auth/login/", {
            "identifier": "emp@test.com",
            "password": "Test1234"
        })
        
        assert response.status_code == 401


# ============================================================
# End-to-End Flow Tests
# ============================================================

@pytest.mark.django_db
class TestCompleteUserJourney:
    """Test complete user journeys."""

    def test_applicant_complete_journey(self):
        """Test applicant: signup → login → access profile."""
        client = APIClient()
        
        # 1. Signup
        response = client.post("/api/accounts/signup/applicant/", {
            "full_name": "Ahmad Ali",
            "email": "ahmad@test.com",
            "national_id": "1234567890",
            "wallet_address": "0x1234567890123456789012345678901234567890",
            "password": "Test1234",
            "confirm_password": "Test1234"
        })
        assert response.status_code == 201
        
        # 2. Login
        response = client.post("/api/accounts/auth/login/", {
            "identifier": "ahmad@test.com",
            "password": "Test1234"
        })
        assert response.status_code == 200
        token = response.data["access"]
        
        # 3. Access profile
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = client.get("/api/accounts/auth/me/")
        assert response.status_code == 200
        assert response.data["profile"]["full_name"] == "Ahmad Ali"