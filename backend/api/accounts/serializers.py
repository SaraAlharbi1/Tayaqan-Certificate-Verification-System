"""Serializers: request/response contracts + validation."""
from django.db import transaction
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.encoding import force_bytes, smart_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode

from rest_framework import serializers
from rest_framework.exceptions import ValidationError, AuthenticationFailed
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User, Applicant, Employer, Institution
from .utils import normalize_national_id, normalize_cr_number, keccak256_hex
from .validators import is_email, is_national_id_10_digits, validate_phone, strong_password

PDF_MIME = "application/pdf"
MAX_PROOF_SIZE = 5 * 1024 * 1024  # 5 MB


class LoginSerializer(serializers.Serializer):
    """Login by email OR applicant national ID + password. Blocks PENDING employers/institutions."""
    identifier = serializers.CharField()
    password = serializers.CharField(write_only=True)

    access = serializers.CharField(read_only=True)
    refresh = serializers.CharField(read_only=True)
    user = serializers.DictField(read_only=True)

    def validate(self, attrs):
        ident = attrs.get("identifier", "").strip()
        password = attrs.get("password", "")
        user = None

        # Resolve user by email or applicant national ID
        if is_email(ident):
            user = User.objects.filter(email__iexact=ident).first()
        else:
            nid = normalize_national_id(ident)
            if is_national_id_10_digits(nid):
                a = Applicant.objects.select_related("user").filter(national_id_plain=nid).first()
                user = getattr(a, "user", None)

        if not user or not user.check_password(password):
            raise AuthenticationFailed("Invalid credentials")

        # Enforce approval before login for employers and institutions
        if user.role == User.Roles.EMPLOYER:
            e = getattr(user, "employer", None)
            if not e or e.status != Employer.Status.APPROVED:
                raise AuthenticationFailed("Employer account is not approved yet.")
        if user.role == User.Roles.INSTITUTION:
            i = getattr(user, "institution", None)
            if not i or i.status != Institution.Status.APPROVED:
                raise AuthenticationFailed("Institution account is not approved yet.")

        refresh = RefreshToken.for_user(user)

        # Minimal profile payload per role
        profile = {}
        if user.role == User.Roles.APPLICANT and hasattr(user, "applicant"):
            a = user.applicant
            profile = {"full_name": a.full_name, "national_id": a.national_id_plain, "phone": a.phone}
        elif user.role == User.Roles.EMPLOYER and hasattr(user, "employer"):
            e = user.employer
            profile = {
                "full_name": e.full_name,
                "company_name": e.company_name,
                "cr_number": e.cr_number_plain,
                "phone": e.phone,
                "status": e.status,
            }
        elif user.role == User.Roles.INSTITUTION and hasattr(user, "institution"):
            i = user.institution
            profile = {
                "institution_name": i.institution_name,
                "department": i.department,
                "phone": i.phone,
                "status": i.status,
            }
        elif user.role == User.Roles.ADMIN:
            profile = {"email": user.email}

        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {"id": user.id, "email": user.email, "role": user.role, "profile": profile},
        }


class MeSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField()
    role = serializers.CharField()
    profile = serializers.DictField()
    status = serializers.CharField(required=False)


class ApplicantSignupSerializer(serializers.Serializer):
    """Create Applicant (saves plain ID and keccak hash)."""
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
    """Submit Employer for approval."""
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
            phone=validated.get("phone", ""),
            proof_doc=validated["proof_doc"],
        )
        return user


class InstitutionSignupSerializer(serializers.Serializer):
    """Submit Institution for approval."""
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
    """Moderation payload."""
    status = serializers.ChoiceField(choices=["APPROVED", "REJECTED"])
    notes = serializers.CharField(allow_blank=True, required=False)


class PasswordResetRequestSerializer(serializers.Serializer):
    """Request password reset link."""
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
            message=f"Click the link to reset your password:\n{reset_url}\n\nIf you didn't request this, ignore it.",
            from_email=None,
        )
        return {"uid": uidb64, "token": token}


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Reset password with uid+token."""
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=8, write_only=True)

    def validate(self, attrs):
        uidb64 = attrs["uid"]
        token = attrs["token"]
        try:
            uid = smart_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except Exception:
            raise ValidationError({"uid": "Invalid UID"})
        if not PasswordResetTokenGenerator().check_token(user, token):
            raise ValidationError({"token": "Invalid or expired token"})
        attrs["user"] = user
        return attrs

    def save(self, **kwargs):
        user = self.validated_data["user"]
        new_password = self.validated_data["new_password"]
        user.set_password(new_password)
        user.save(update_fields=["password"])
        return user
