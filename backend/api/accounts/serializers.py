"""
API serializers for Accounts domain.
Handles validation and transformation for signup, login, and admin operations.
"""

from django.db import transaction
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.encoding import force_bytes, smart_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode

from rest_framework import serializers
from rest_framework.exceptions import ValidationError, AuthenticationFailed
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User, Applicant, Employer, Institution
from .utils import normalize_national_id, keccak256_hex
from .validators import (
    is_email,
    is_national_id_10_digits,
    validate_phone,
    strong_password,
    is_eth_address,
)

PDF_MIME = "application/pdf"
MAX_PROOF_SIZE = 5 * 1024 * 1024  # 5 MB


# ============================================================
# Authentication
# ============================================================

class LoginSerializer(serializers.Serializer):
    """
    Login with email/password or national ID/password.
    Returns JWT tokens + user profile.
    """

    identifier = serializers.CharField()
    password = serializers.CharField(write_only=True)

    access = serializers.CharField(read_only=True)
    refresh = serializers.CharField(read_only=True)
    user = serializers.DictField(read_only=True)

    def validate(self, attrs):
        ident = attrs.get("identifier", "").strip()
        password = attrs.get("password", "")

        user = None

        # Try email first
        if is_email(ident):
            user = User.objects.filter(email__iexact=ident).first()
        else:
            # Try national ID (applicant only)
            nid = normalize_national_id(ident)
            if is_national_id_10_digits(nid):
                applicant = Applicant.objects.select_related("user").filter(
                    national_id_plain=nid
                ).first()
                user = getattr(applicant, "user", None)

        if not user or not user.check_password(password):
            raise AuthenticationFailed("Invalid credentials")

        # Block unapproved employers/institutions
        if user.role == User.Roles.EMPLOYER:
            employer = getattr(user, "employer", None)
            if not employer or employer.status != Employer.Status.APPROVED:
                raise AuthenticationFailed("Account pending approval")
                
        if user.role == User.Roles.INSTITUTION:
            institution = getattr(user, "institution", None)
            if not institution or institution.status != Institution.Status.APPROVED:
                raise AuthenticationFailed("Account pending approval")

        # Generate tokens
        refresh = RefreshToken.for_user(user)

        # Build profile based on role
        profile = self._build_profile(user)

        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {
                "id": user.id,
                "email": user.email,
                "role": user.role,
                "profile": profile,
            },
        }

    def _build_profile(self, user):
        """Build role-specific profile data."""
        if user.role == User.Roles.APPLICANT and hasattr(user, "applicant"):
            a = user.applicant
            return {
                "full_name": a.full_name,
                "national_id": a.national_id_plain,
                "phone": a.phone,
                "wallet_address": a.wallet_address,
            }
            
        elif user.role == User.Roles.EMPLOYER and hasattr(user, "employer"):
            e = user.employer
            return {
                "full_name": e.full_name,
                "company_name": e.company_name,
                "official_email": e.official_email,
                "phone": e.phone,
                "status": e.status,
            }
            
        elif user.role == User.Roles.INSTITUTION and hasattr(user, "institution"):
            i = user.institution
            return {
                "institution_name": i.institution_name,
                "institution_id": i.institution_id,
                "official_email": i.official_email,
                "phone": i.phone,
                "status": i.status,
                "wallet_address": i.wallet_address,
                "contract_address": i.contract_address,
            }
            
        elif user.role == User.Roles.ADMIN:
            return {"email": user.email}
            
        return {}


class MeSerializer(serializers.Serializer):
    """Current user profile."""
    id = serializers.IntegerField()
    email = serializers.EmailField()
    role = serializers.CharField()
    profile = serializers.DictField()
    status = serializers.CharField(required=False)


# ============================================================
# Applicant Signup
# ============================================================

class ApplicantSignupSerializer(serializers.Serializer):
    """
    Create applicant account.
    Stores: national ID (plain + hash), wallet address.
    """

    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    national_id = serializers.CharField()
    wallet_address = serializers.CharField(max_length=42)
    phone = serializers.CharField(allow_blank=True, required=False)
    password = serializers.CharField()
    confirm_password = serializers.CharField()

    def validate(self, data):
        # Check email uniqueness
        if User.objects.filter(email__iexact=data["email"]).exists():
            raise ValidationError({"email": ["Email already registered"]})

        # Normalize and validate national ID
        nid_plain = normalize_national_id(data["national_id"])
        if not is_national_id_10_digits(nid_plain):
            raise ValidationError({"national_id": ["Enter valid 10-digit national ID"]})

        if Applicant.objects.filter(national_id_plain=nid_plain).exists():
            raise ValidationError({"national_id": ["National ID already registered"]})

        # Validate wallet address
        addr = data.get("wallet_address", "").strip()
        if not is_eth_address(addr):
            raise ValidationError({"wallet_address": ["Enter valid Ethereum address (0x...)"]})

        # Password validation
        if not strong_password(data["password"]):
            raise ValidationError({"password": ["Password must be 8+ chars with letters & numbers"]})
        if data["password"] != data["confirm_password"]:
            raise ValidationError({"confirm_password": ["Passwords do not match"]})

        # Phone validation (optional)
        if data.get("phone") and not validate_phone(data["phone"]):
            raise ValidationError({"phone": ["Enter valid phone number"]})

        # Add computed fields
        data["national_id_plain"] = nid_plain
        data["national_id_hash"] = keccak256_hex(nid_plain)
        return data

    @transaction.atomic
    def create(self, validated):
        """Create user + applicant profile."""
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
            wallet_address=validated["wallet_address"],
            phone=validated.get("phone", ""),
        )
        return user


# ============================================================
# Employer Signup
# ============================================================

class EmployerSignupSerializer(serializers.Serializer):
    """
    Submit employer account for admin approval.
    Requires: proof document (PDF).
    """

    full_name = serializers.CharField(max_length=150)
    official_email = serializers.EmailField()
    company_name = serializers.CharField(max_length=200)
    phone = serializers.CharField(allow_blank=True, required=False)
    password = serializers.CharField()
    confirm_password = serializers.CharField()
    proof_doc = serializers.FileField()

    def validate(self, data):
        # Check email uniqueness
        if User.objects.filter(email__iexact=data["official_email"]).exists():
            raise ValidationError({"official_email": ["Email already registered"]})

        # Password validation
        if not strong_password(data["password"]):
            raise ValidationError({"password": ["Password must be 8+ chars with letters & numbers"]})
        if data["password"] != data["confirm_password"]:
            raise ValidationError({"confirm_password": ["Passwords do not match"]})

        # Phone validation (optional)
        if data.get("phone") and not validate_phone(data["phone"]):
            raise ValidationError({"phone": ["Enter valid phone number"]})

        # Proof document: PDF only, max 5MB
        f = data["proof_doc"]
        if getattr(f, "content_type", None) != PDF_MIME:
            raise ValidationError({"proof_doc": ["Only PDF files allowed"]})
        if f.size > MAX_PROOF_SIZE:
            raise ValidationError({"proof_doc": ["File too large (max 5MB)"]})

        return data

    @transaction.atomic
    def create(self, validated):
        """Create user + employer profile (status: PENDING)."""
        user = User.objects.create_user(
            email=validated["official_email"],
            password=validated["password"],
            role=User.Roles.EMPLOYER,
        )
        Employer.objects.create(
            user=user,
            full_name=validated["full_name"],
            company_name=validated["company_name"],
            official_email=validated["official_email"],
            phone=validated.get("phone", ""),
            proof_doc=validated["proof_doc"],
        )
        return user


# ============================================================
# Institution Signup
# ============================================================

class InstitutionSignupSerializer(serializers.Serializer):
    """
    Submit institution account for admin approval.
    Requires: wallet address, proof document (PDF).
    On approval: auto-deploys CertificateRegistry contract.
    """

    institution_name = serializers.CharField(max_length=200)
    official_email = serializers.EmailField()
    phone = serializers.CharField(allow_blank=True, required=False)
    wallet_address = serializers.CharField(max_length=42)
    password = serializers.CharField()
    confirm_password = serializers.CharField()
    proof_doc = serializers.FileField()

    def validate(self, data):
        # Check email uniqueness
        if User.objects.filter(email__iexact=data["official_email"]).exists():
            raise ValidationError({"official_email": ["Email already registered"]})

        # Validate wallet address
        addr = data.get("wallet_address", "").strip()
        if not is_eth_address(addr):
            raise ValidationError({"wallet_address": ["Enter valid Ethereum address (0x...)"]})
        if Institution.objects.filter(wallet_address__iexact=addr).exists():
            raise ValidationError({"wallet_address": ["Wallet already used by another institution"]})

        # Password validation
        if not strong_password(data["password"]):
            raise ValidationError({"password": ["Password must be 8+ chars with letters & numbers"]})
        if data["password"] != data["confirm_password"]:
            raise ValidationError({"confirm_password": ["Passwords do not match"]})

        # Phone validation (optional)
        if data.get("phone") and not validate_phone(data["phone"]):
            raise ValidationError({"phone": ["Enter valid phone number"]})

        # Proof document: PDF only, max 5MB
        f = data["proof_doc"]
        if getattr(f, "content_type", None) != PDF_MIME:
            raise ValidationError({"proof_doc": ["Only PDF files allowed"]})
        if f.size > MAX_PROOF_SIZE:
            raise ValidationError({"proof_doc": ["File too large (max 5MB)"]})

        return data

    @transaction.atomic
    def create(self, validated):
        """Create user + institution profile (status: PENDING)."""
        user = User.objects.create_user(
            email=validated["official_email"],
            password=validated["password"],
            role=User.Roles.INSTITUTION,
        )
        Institution.objects.create(
            user=user,
            institution_name=validated["institution_name"],
            official_email=validated["official_email"],
            phone=validated.get("phone", ""),
            wallet_address=validated["wallet_address"],
            proof_doc=validated["proof_doc"],
        )
        return user


# ============================================================
# Admin Operations
# ============================================================

class AdminStatusUpdateSerializer(serializers.Serializer):
    """Admin approves or rejects employer/institution."""
    status = serializers.ChoiceField(choices=["APPROVED", "REJECTED"])


# ============================================================
# Password Reset
# ============================================================

class PasswordResetRequestSerializer(serializers.Serializer):
    """Request password reset email with token link."""
    
    email = serializers.EmailField()

    def validate_email(self, value):
        self.user = User.objects.filter(email__iexact=value).first()
        return value

    def save(self, **kwargs):
        user = getattr(self, "user", None)
        if not user:
            return None

        token = PasswordResetTokenGenerator().make_token(user)
        uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
        base = kwargs.get("frontend_base")
        reset_url = f"{base}?uid={uidb64}&token={token}"

        user.email_user(
            subject="Reset your Tayaqan password",
            message=f"Click to reset: {reset_url}\n\nIgnore if you didn't request this.",
            from_email=None,
        )
        return {"uid": uidb64, "token": token}


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Confirm password reset with uid + token."""
    
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=8, write_only=True)

    def validate(self, attrs):
        try:
            uid = smart_str(urlsafe_base64_decode(attrs["uid"]))
            user = User.objects.get(pk=uid)
        except Exception:
            raise ValidationError({"uid": "Invalid UID"})

        if not PasswordResetTokenGenerator().check_token(user, attrs["token"]):
            raise ValidationError({"token": "Invalid or expired token"})

        attrs["user"] = user
        return attrs

    def save(self, **kwargs):
        user = self.validated_data["user"]
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user