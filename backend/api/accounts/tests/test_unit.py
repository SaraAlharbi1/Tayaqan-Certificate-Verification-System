"""Unit tests for Accounts app."""

import pytest
from django.core.exceptions import ValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError, AuthenticationFailed

from api.accounts.models import User, Applicant, Employer, Institution
from api.accounts.serializers import (
    ApplicantSignupSerializer,
    LoginSerializer,
    EmployerSignupSerializer,
    InstitutionSignupSerializer
)
from api.accounts.validators import (
    is_email,
    is_national_id_10_digits,
    validate_phone,
    strong_password,
    is_eth_address
)
from api.accounts.utils import normalize_national_id, keccak256_hex


# ============================================================
# Model Tests
# ============================================================

@pytest.mark.django_db
class TestUserModel:
    """Test User model."""

    def test_create_user_with_email(self):
        user = User.objects.create_user(email="test@example.com", password="pass123")
        assert user.email == "test@example.com"
        assert user.check_password("pass123")
        assert user.role == User.Roles.APPLICANT

    def test_create_superuser(self):
        admin = User.objects.create_superuser(email="admin@example.com", password="admin123")
        assert admin.is_staff
        assert admin.is_superuser
        assert admin.role == User.Roles.ADMIN


@pytest.mark.django_db
class TestApplicantModel:
    """Test Applicant model."""

    def test_create_applicant(self):
        user = User.objects.create_user(email="applicant@test.com", password="pass")
        applicant = Applicant.objects.create(
            user=user,
            full_name="Ahmad Ali",
            national_id_plain="1234567890",
            national_id_hash="0xabc123",
            wallet_address="0x1234567890123456789012345678901234567890"
        )
        assert applicant.full_name == "Ahmad Ali"
        assert str(applicant) == "Ahmad Ali (1234567890)"


@pytest.mark.django_db
class TestEmployerModel:
    """Test Employer model."""

    def test_employer_default_status(self):
        user = User.objects.create_user(email="employer@test.com", password="pass")
        employer = Employer.objects.create(
            user=user,
            full_name="John Doe",
            company_name="Test Corp",
            official_email="hr@test.com"
        )
        assert employer.status == Employer.Status.PENDING


@pytest.mark.django_db
class TestInstitutionModel:
    """Test Institution model."""

    def test_institution_default_status(self):
        user = User.objects.create_user(email="uni@test.com", password="pass")
        institution = Institution.objects.create(
            user=user,
            institution_name="Test University",
            official_email="info@uni.com",
            wallet_address="0x1234567890123456789012345678901234567890"
        )
        assert institution.status == Institution.Status.PENDING
        assert institution.institution_id is None
        assert institution.contract_address is None

    def test_generate_institution_id(self):
        user = User.objects.create_user(email="uni@test.com", password="pass")
        institution = Institution.objects.create(
            user=user,
            institution_name="King Saud University",
            official_email="info@ksu.edu",
            wallet_address="0x1234567890123456789012345678901234567890"
        )
        inst_id = institution.generate_institution_id()
        assert inst_id.startswith("KIN-")
        assert len(inst_id) == 7

    def test_institution_id_uniqueness(self):
        user1 = User.objects.create_user(email="uni1@test.com", password="pass")
        user2 = User.objects.create_user(email="uni2@test.com", password="pass")
        
        inst1 = Institution.objects.create(
            user=user1,
            institution_name="King University",
            official_email="info@king1.com",
            wallet_address="0x1111111111111111111111111111111111111111"
        )
        inst1.institution_id = inst1.generate_institution_id()
        inst1.save()
        
        inst2 = Institution.objects.create(
            user=user2,
            institution_name="King College",
            official_email="info@king2.com",
            wallet_address="0x2222222222222222222222222222222222222222"
        )
        inst2.institution_id = inst2.generate_institution_id()
        
        assert inst1.institution_id != inst2.institution_id


# ============================================================
# Serializer Tests
# ============================================================

@pytest.mark.django_db
class TestApplicantSignupSerializer:
    """Test Applicant signup serializer."""

    def test_valid_applicant_signup(self):
        data = {
            "full_name": "Ahmad Ali",
            "email": "ahmad@test.com",
            "national_id": "1234567890",
            "wallet_address": "0x1234567890123456789012345678901234567890",
            "password": "Test1234",
            "confirm_password": "Test1234"
        }
        serializer = ApplicantSignupSerializer(data=data)
        assert serializer.is_valid()

    def test_duplicate_email_rejected(self):
        User.objects.create_user(email="test@test.com", password="pass")
        data = {
            "full_name": "Test",
            "email": "test@test.com",
            "national_id": "1234567890",
            "wallet_address": "0x1234567890123456789012345678901234567890",
            "password": "Test1234",
            "confirm_password": "Test1234"
        }
        serializer = ApplicantSignupSerializer(data=data)
        assert not serializer.is_valid()
        assert "email" in serializer.errors

    def test_password_mismatch(self):
        data = {
            "full_name": "Test",
            "email": "test@test.com",
            "national_id": "1234567890",
            "wallet_address": "0x1234567890123456789012345678901234567890",
            "password": "Test1234",
            "confirm_password": "Different1234"
        }
        serializer = ApplicantSignupSerializer(data=data)
        assert not serializer.is_valid()
        assert "confirm_password" in serializer.errors


@pytest.mark.django_db
class TestLoginSerializer:
    """Test Login serializer."""

    def test_login_with_email(self):
        User.objects.create_user(email="test@test.com", password="Test1234")
        data = {"identifier": "test@test.com", "password": "Test1234"}
        serializer = LoginSerializer(data=data)
        assert serializer.is_valid()

    def test_login_with_national_id(self):
        user = User.objects.create_user(email="test@test.com", password="Test1234")
        Applicant.objects.create(
            user=user,
            full_name="Test",
            national_id_plain="1234567890",
            national_id_hash="0xabc",
            wallet_address="0x1234567890123456789012345678901234567890"
        )
        data = {"identifier": "1234567890", "password": "Test1234"}
        serializer = LoginSerializer(data=data)
        assert serializer.is_valid()

    def test_invalid_credentials(self):
        """Test that invalid credentials raise AuthenticationFailed."""
        User.objects.create_user(email="test@test.com", password="Test1234")
        data = {"identifier": "test@test.com", "password": "WrongPassword"}
        serializer = LoginSerializer(data=data)
        
        # Expect AuthenticationFailed exception, not is_valid() = False
        with pytest.raises(AuthenticationFailed):
            serializer.is_valid(raise_exception=True)


# ============================================================
# Validator Tests
# ============================================================

class TestValidators:
    """Test validation functions."""

    def test_email_validator(self):
        assert is_email("test@example.com")
        assert is_email("user@domain.co.uk")
        assert not is_email("notanemail")
        assert not is_email("@example.com")

    def test_national_id_validator(self):
        assert is_national_id_10_digits("1234567890")
        assert not is_national_id_10_digits("123")
        assert not is_national_id_10_digits("12345678901")

    def test_phone_validator(self):
        assert validate_phone("+966501234567")
        assert validate_phone("0501234567")
        assert not validate_phone("123")

    def test_password_validator(self):
        assert strong_password("Test1234")
        assert not strong_password("short")
        assert not strong_password("12345678")
        assert not strong_password("onlyletters")

    def test_eth_address_validator(self):
        assert is_eth_address("0x1234567890123456789012345678901234567890")
        assert not is_eth_address("1234567890123456789012345678901234567890")
        assert not is_eth_address("0x123")


# ============================================================
# Utility Tests
# ============================================================

class TestUtils:
    """Test utility functions."""

    def test_normalize_national_id(self):
        assert normalize_national_id("1234567890") == "1234567890"
        assert normalize_national_id("123 456 7890") == "1234567890"
        assert normalize_national_id("١٢٣٤٥٦٧٨٩٠") == "1234567890"
        assert normalize_national_id("ID-123-456-7890") == "1234567890"

    def test_keccak256_hex(self):
        result = keccak256_hex("test")
        assert result.startswith("0x")
        assert len(result) == 66
        
        hash1 = keccak256_hex("1234567890")
        hash2 = keccak256_hex("1234567890")
        assert hash1 == hash2
        
        hash3 = keccak256_hex("0987654321")
        assert hash1 != hash3