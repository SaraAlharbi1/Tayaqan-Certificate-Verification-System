"""
Domain models for Accounts.

Design
------
- Single auth table (User) with a 'role' field.
- Applicant keeps BOTH:
    * national_id_plain    → for web UI and exact lookups (your requirement)
    * national_id_hash     → keccak256(plain UTF-8), used for blockchain/events
- Employer keeps BOTH:
    * cr_number_plain      → for web UI and forms
    * verifier_id_hash     → keccak256(plain UTF-8), used for blockchain/events
- Institution profile is similar to Employer but without a chain hash for now.
"""

from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager


class UserManager(BaseUserManager):
    """
    Custom manager so we authenticate by email (no username field).

    create_user(email, password, **extra_fields)
    -------------------------------------------
    - Normalizes the email.
    - Sets a hashed password (Django handles salt/algorithm).
    - Saves the user.

    create_superuser(email, password, **extra_fields)
    -------------------------------------------------
    - Enforces is_staff + is_superuser.
    - Defaults role to ADMIN.
    """
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

    - We remove 'username' and use 'email' as the login field.
    - 'role' indicates what the user can do in the system.
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
    Applicant personal profile.

    Fields
    ------
    national_id_plain : str
        Canonical 10-digit ID string (ASCII digits). Used for web UI and exact lookup.
    national_id_hash  : str (0x + 64 hex)
        Keccak-256 of the plain ID (UTF-8). Used for blockchain/events.

    We keep both because you want to display the full ID in the UI but only
    hash goes to the chain. The hash is also convenient to compare with on-chain logs.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="applicant")
    full_name = models.CharField(max_length=150)

    national_id_plain = models.CharField(max_length=20, unique=True, db_index=True)
    national_id_hash = models.CharField(max_length=66, unique=True, db_index=True)

    phone = models.CharField(max_length=20, blank=True)

    def __str__(self) -> str:
        return f"Applicant<{self.user.email}>"


class Employer(models.Model):
    """
    Employer/HR company profile.

    status:
        PENDING  - can log in and create access requests (per your rule)
        APPROVED - can view certificate contents when granted
        REJECTED - blocked from business endpoints
    """
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="employer")

    full_name = models.CharField(max_length=150)       # contact person
    work_email = models.EmailField()
    company_name = models.CharField(max_length=200)

    # CR number (Company Identifier) - only plain version needed
    cr_number_plain = models.CharField(max_length=50, unique=True, db_index=True)

    phone = models.CharField(max_length=20, blank=True)
    proof_doc = models.FileField(upload_to="proofs/employers/", blank=True, null=True)

    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    status_notes = models.TextField(blank=True)

    def __str__(self) -> str:
        return f"Employer<{self.company_name}:{self.user.email}>"


class Institution(models.Model):
    """
    Issuing institution (e.g., university). Same approval lifecycle as Employer.
    """
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

    def __str__(self) -> str:
        return f"Institution<{self.institution_name}:{self.user.email}>"