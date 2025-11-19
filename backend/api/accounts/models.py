"""Accounts models: User, Applicant, Employer, Institution."""

from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager


class UserManager(BaseUserManager):
    """Custom user manager with email as username."""

    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email required")
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
    """Auth user with role-based access."""

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

    def __str__(self):
        return f"{self.email} ({self.role})"


class Applicant(models.Model):
    """Applicant with national ID and wallet."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="applicant")
    full_name = models.CharField(max_length=150)
    
    # National ID: plain for search, hash for blockchain
    national_id_plain = models.CharField(max_length=20, unique=True, db_index=True)
    national_id_hash = models.CharField(max_length=66, unique=True, db_index=True)
    
    wallet_address = models.CharField(max_length=42)
    phone = models.CharField(max_length=20, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.full_name} ({self.national_id_plain})"


class Employer(models.Model):
    """Employer requiring admin approval."""

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="employer")
    full_name = models.CharField(max_length=150)
    company_name = models.CharField(max_length=200)
    official_email = models.EmailField()
    phone = models.CharField(max_length=20, blank=True)
    proof_doc = models.FileField(upload_to="proofs/employers/")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.company_name} - {self.status}"


class Institution(models.Model):
    """
    Institution with blockchain contract.
    On approval: auto-deploys CertificateRegistry contract.
    """

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="institution")
    
    # Basic info
    institution_name = models.CharField(max_length=200)
    official_email = models.EmailField()
    phone = models.CharField(max_length=20, blank=True)
    wallet_address = models.CharField(max_length=42)
    proof_doc = models.FileField(upload_to="proofs/institutions/")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    
    # Blockchain data (auto-filled on approval)
    institution_id = models.CharField(max_length=50, unique=True, blank=True, null=True, db_index=True)
    contract_address = models.CharField(max_length=42, blank=True, null=True, unique=True)
    deployed_at = models.DateTimeField(blank=True, null=True)
    registered_in_registry = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['institution_id']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.institution_name} ({self.institution_id or 'pending'})"
    
    def generate_institution_id(self):
        """Generate unique ID from institution name (e.g., KSU-001)."""
        if self.institution_id:
            return self.institution_id
        
        # Extract first 3 letters
        base = ''.join(filter(str.isalnum, self.institution_name))[:3].upper()
        counter = 1
        
        while True:
            candidate = f"{base}-{counter:03d}"
            if not Institution.objects.filter(institution_id=candidate).exists():
                return candidate
            counter += 1