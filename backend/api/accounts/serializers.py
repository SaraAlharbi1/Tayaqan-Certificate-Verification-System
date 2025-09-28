"""
Serializers: request/response contracts + validation.

Contains
--------
- LoginSerializer:
    Accepts email OR exact national ID (10 digits) + password; returns JWTs.
- MeSerializer:
    Response shape for /api/me (role-aware; shows full IDs per your policy).
- ApplicantSignupSerializer:
    Normalizes & validates ID, stores national_id_plain, computes national_id_hash.
- EmployerSignupSerializer:
    Normalizes & validates CR, stores cr_number_plain, computes verifier_id_hash.
- InstitutionSignupSerializer:
    Validates institution profile with proof PDF.
- AdminStatusUpdateSerializer:
    Admin approves/rejects org accounts.
"""
from django.db import transaction
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User, Applicant, Employer, Institution
from .utils import normalize_national_id, normalize_cr_number, keccak256_hex
from .validators import (
    is_email, is_national_id_10_digits, validate_phone, strong_password
)

PDF_MIME = "application/pdf"
MAX_PROOF_SIZE = 5 * 1024 * 1024  # 5 MB


class LoginSerializer(serializers.Serializer):
    """
    Login with:
    - identifier: email OR 10-digit national ID (applicant only)
    - password:   Django password

    Flow:
    1) If it looks like an email → lookup User by email.
    2) Otherwise normalize as national ID and lookup Applicant by national_id_plain.
    3) Verify password and issue JWT tokens.
    """
    identifier = serializers.CharField()
    password = serializers.CharField()

    def validate(self, attrs):
        ident = attrs.get("identifier", "").strip()
        password = attrs.get("password", "")

        user = None
        if is_email(ident):
            try:
                user = User.objects.get(email__iexact=ident)
            except User.DoesNotExist:
                pass
        else:
            nid = normalize_national_id(ident)
            if is_national_id_10_digits(nid):
                try:
                    applicant = Applicant.objects.select_related("user").get(national_id_plain=nid)
                    user = applicant.user
                except Applicant.DoesNotExist:
                    pass

        if not user or not user.check_password(password):
            raise ValidationError({"message": "Invalid credentials"}, code="auth_failed")

        refresh = RefreshToken.for_user(user)
        return {"access": str(refresh.access_token), "refresh": str(refresh)}


class MeSerializer(serializers.Serializer):
    """Shape of /api/me response (role-aware)."""
    id = serializers.IntegerField()
    email = serializers.EmailField()
    role = serializers.CharField()
    profile = serializers.DictField()
    status = serializers.CharField(required=False)


class ApplicantSignupSerializer(serializers.Serializer):
    """
    Applicant registration:

    - Normalize the provided ID to canonical ASCII digits.
    - Enforce exactly 10 digits.
    - Save national_id_plain (for UI) and national_id_hash = keccak256(plain).
    """
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    national_id = serializers.CharField()
    phone = serializers.CharField(allow_blank=True, required=False)
    password = serializers.CharField()
    confirm_password = serializers.CharField()

    def validate(self, data):
        if User.objects.filter(email__iexact=data["email"]).exists():
            raise ValidationError({"email": ["Email already registered"]})

        nid_plain = normalize_national_id(data["national_id"])
        if not is_national_id_10_digits(nid_plain):
            raise ValidationError({"national_id": ["Enter a valid 10-digit ID"]})

        if not strong_password(data["password"]):
            raise ValidationError({"password": ["Password must be 8+ chars incl. letters & numbers"]})
        if data["password"] != data["confirm_password"]:
            raise ValidationError({"confirm_password": ["Passwords do not match"]})
        if data.get("phone") and not validate_phone(data["phone"]):
            raise ValidationError({"phone": ["Enter a valid phone number"]})

        if Applicant.objects.filter(national_id_plain=nid_plain).exists():
            raise ValidationError({"national_id": ["An account with this ID already exists"]})

        data["national_id_plain"] = nid_plain
        data["national_id_hash"] = keccak256_hex(nid_plain)
        return data

    @transaction.atomic
    def create(self, validated):
        """
        Create:
        - User(role=APPLICANT)
        - Applicant profile with plain ID + hash
        """
        user = User.objects.create_user(
            email=validated["email"],
            password=validated["password"],
            role=User.Roles.APPLICANT,
        )
        Applicant.objects.create(
            user=user,
            full_name=validated["full_name"],
            national_id_plain=validated["national_id_plain"],
            national_id_hash=validated["national_id_hash"],
            phone=validated.get("phone", ""),
        )
        return user


class EmployerSignupSerializer(serializers.Serializer):
    """
    Employer registration (multipart):
    - Normalize CR number, store cr_number_plain, compute verifier_id_hash.
    - Save PDF proof (≤ 5MB).
    - Status starts as PENDING (per your rule).
    """
    full_name = serializers.CharField(max_length=150)
    work_email = serializers.EmailField()
    company_name = serializers.CharField(max_length=200)
    cr_number = serializers.CharField(max_length=50)
    phone = serializers.CharField(allow_blank=True, required=False)
    password = serializers.CharField()
    confirm_password = serializers.CharField()
    proof_doc = serializers.FileField()

    def validate(self, data):
        if User.objects.filter(email__iexact=data["work_email"]).exists():
            raise ValidationError({"work_email": ["Email already registered"]})
        if not strong_password(data["password"]):
            raise ValidationError({"password": ["Password must be 8+ chars incl. letters & numbers"]})
        if data["password"] != data["confirm_password"]:
            raise ValidationError({"confirm_password": ["Passwords do not match"]})

        f = data["proof_doc"]
        if getattr(f, "content_type", None) != PDF_MIME:
            raise ValidationError({"proof_doc": ["Only PDF files are allowed"]})
        if f.size > MAX_PROOF_SIZE:
            raise ValidationError({"proof_doc": ["File too large (max 5MB)"]})

        cr_plain = normalize_cr_number(data["cr_number"])
        if not cr_plain:
            raise ValidationError({"cr_number": ["Enter a valid CR number"]})
        if Employer.objects.filter(cr_number_plain=cr_plain).exists():
            raise ValidationError({"cr_number": ["This CR number is already registered"]})

        data["cr_number_plain"] = cr_plain
        data["verifier_id_hash"] = keccak256_hex(cr_plain)
        return data

    @transaction.atomic
    def create(self, validated):
        user = User.objects.create_user(
            email=validated["work_email"],
            password=validated["password"],
            role=User.Roles.EMPLOYER,
        )
        Employer.objects.create(
            user=user,
            full_name=validated["full_name"],
            work_email=validated["work_email"],
            company_name=validated["company_name"],
            cr_number_plain=validated["cr_number_plain"],
            verifier_id_hash=validated["verifier_id_hash"],
            phone=validated.get("phone", ""),
            proof_doc=validated["proof_doc"],
        )
        return user


class InstitutionSignupSerializer(serializers.Serializer):
    """
    Institution registration (multipart).
    """
    institution_name = serializers.CharField(max_length=200)
    official_email = serializers.EmailField()
    department = serializers.CharField(max_length=150, allow_blank=True, required=False)
    phone = serializers.CharField(allow_blank=True, required=False)
    password = serializers.CharField()
    confirm_password = serializers.CharField()
    proof_doc = serializers.FileField()

    def validate(self, data):
        if User.objects.filter(email__iexact=data["official_email"]).exists():
            raise ValidationError({"official_email": ["Email already registered"]})
        if not strong_password(data["password"]):
            raise ValidationError({"password": ["Password must be 8+ chars incl. letters & numbers"]})
        if data["password"] != data["confirm_password"]:
            raise ValidationError({"confirm_password": ["Passwords do not match"]})
        f = data["proof_doc"]
        if getattr(f, "content_type", None) != PDF_MIME:
            raise ValidationError({"proof_doc": ["Only PDF files are allowed"]})
        if f.size > MAX_PROOF_SIZE:
            raise ValidationError({"proof_doc": ["File too large (max 5MB)"]})
        return data

    @transaction.atomic
    def create(self, validated):
        user = User.objects.create_user(
            email=validated["official_email"],
            password=validated["password"],
            role=User.Roles.INSTITUTION,
        )
        Institution.objects.create(
            user=user,
            institution_name=validated["institution_name"],
            official_email=validated["official_email"],
            department=validated.get("department", ""),
            phone=validated.get("phone", ""),
            proof_doc=validated["proof_doc"],
        )
        return user


class AdminStatusUpdateSerializer(serializers.Serializer):
    """
    Admin-only moderation payload:
    - status: APPROVED / REJECTED
    - notes: optional free text
    """
    status = serializers.ChoiceField(choices=["APPROVED", "REJECTED"])
    notes = serializers.CharField(allow_blank=True, required=False)
