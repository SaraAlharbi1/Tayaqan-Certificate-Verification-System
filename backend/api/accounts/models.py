"""Domain models for Accounts (single auth table + role-specific profiles)."""
from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager


class UserManager(BaseUserManager):
    """Authenticate by email (no username)."""

    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.Roles.ADMIN)
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    """
    Single authentication table.
    - Use 'email' as the login field
    - 'role' controls capabilities
    """

    class Roles(models.TextChoices):
        APPLICANT = "APPLICANT", "Applicant"
        EMPLOYER = "EMPLOYER", "Employer"
        INSTITUTION = "INSTITUTION", "Institution"
        ADMIN = "ADMIN", "Admin"

    username = None
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=Roles.choices, default=Roles.APPLICANT)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self) -> str:
        return f"{self.email} ({self.role})"


class Applicant(models.Model):
    """
    Applicant profile.
    Keep both plain and hash:
    - plain for UI + exact lookup
    - hash (0x + 64) for on-chain and event comparisons
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="applicant")
    full_name = models.CharField(max_length=150)

    national_id_plain = models.CharField(max_length=20, unique=True, db_index=True)
    national_id_hash = models.CharField(max_length=66, unique=True, db_index=True)

    phone = models.CharField(max_length=20, blank=True)

    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Applicant<{self.user.email}>"


class Employer(models.Model):
    """Employer/HR profile with moderation lifecycle."""

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"   
        APPROVED = "APPROVED", "Approved"  
        REJECTED = "REJECTED", "Rejected"   

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="employer")

    full_name = models.CharField(max_length=150)   # contact person
    work_email = models.EmailField()
    company_name = models.CharField(max_length=200)

    # Company identifier for UI/forms
    cr_number_plain = models.CharField(max_length=50, unique=True, db_index=True)

    phone = models.CharField(max_length=20, blank=True)
    proof_doc = models.FileField(upload_to="proofs/employers/", blank=True, null=True)

    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    status_notes = models.TextField(blank=True)

    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Employer<{self.company_name}:{self.user.email}>"


class Institution(models.Model):
    """Issuing institution profile with same moderation lifecycle as Employer."""

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="institution")

    institution_name = models.CharField(max_length=200)
    official_email = models.EmailField()
    department = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    proof_doc = models.FileField(upload_to="proofs/institutions/", blank=True, null=True)

    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    status_notes = models.TextField(blank=True)

    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Institution<{self.institution_name}:{self.user.email}>"
