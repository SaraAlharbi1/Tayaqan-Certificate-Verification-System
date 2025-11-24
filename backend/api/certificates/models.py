"""Certificate model with blockchain integration."""

from django.conf import settings
from django.db import models


class Certificate(models.Model):
    """
    Certificate record with blockchain proof.
    
    Database stores:
    - Full metadata (title, dates, relationships)
    - Storacha CID (for PDF storage)
    - Blockchain data (contract address, tx hash, block number)
    - File hash (used as key in smart contract)
    - Revocation blockchain data (tx hash, block number, timestamp)
    
    Smart contract stores:
    - certificateHash (file_hash)
    - applicantIdHash (keccak256 of national ID)
    - certificateType (display_label / certificate_type)
    - issueDate (timestamp)
    - isRevoked (boolean)
    """

    # ============================================================
    # Relationships
    # ============================================================
    
    institution = models.ForeignKey(
        "accounts.Institution",
        on_delete=models.CASCADE,
        related_name="certificates",
        help_text="Institution that issued this certificate",
    )
    
    applicant = models.ForeignKey(
        "accounts.Applicant",
        on_delete=models.CASCADE,
        related_name="certificates",
        help_text="Applicant who received this certificate",
    )
    
    created_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="User who created this certificate",
    )

    # ============================================================
    # Storacha Storage
    # ============================================================
    
    file_cid = models.CharField(
        max_length=200,
        db_index=True,
        blank=True,
        help_text="Storacha CID - internal only, used to fetch PDF",
    )

    # ============================================================
    # Certificate Metadata
    # ============================================================
    
    display_label = models.CharField(
        max_length=200,
        help_text="Certificate title/description",
    )

    certificate_type = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Normalized certificate type (Bachelor, Master, Diploma, etc.)",
    )
    
    issued_on = models.DateField(
        null=True,
        blank=True,
        help_text="Date of issuance",
    )
    
    national_id_plain = models.CharField(
        max_length=20,
        blank=True,
        db_index=True,
        help_text="Applicant's national ID - denormalized for search",
    )

    # ============================================================
    # Blockchain Data (Issuance)
    # ============================================================
    
    # ✅ UPDATED: Added unique=True to prevent duplicate certificates
    file_hash = models.CharField(
        max_length=66,
        blank=True,
        db_index=True,
        unique=True,  # ← ADDED: No duplicate file hashes allowed
        help_text="SHA256 hash of PDF file - must be unique globally",
    )
    
    applicant_id_hash = models.CharField(
        max_length=66,
        blank=True,
        help_text="keccak256(national_id)",
    )
    
    contract_address = models.CharField(
        max_length=42,
        blank=True,
        db_index=True,
        help_text="CertificateRegistry contract address",
    )
    
    tx_hash = models.CharField(
        max_length=66,
        blank=True,
        help_text="Blockchain transaction hash for issuance",
    )
    
    block_number = models.BigIntegerField(
        null=True,
        blank=True,
        help_text="Block number where certificate was issued",
    )

    # ============================================================
    # Blockchain Data (Revocation)
    # ============================================================

    revoke_tx_hash = models.CharField(
        max_length=66,
        blank=True,
        help_text="Blockchain transaction hash from revokeCertificate()",
    )

    revoke_block_number = models.BigIntegerField(
        null=True,
        blank=True,
        help_text="Block number where certificate was revoked",
    )

    revoked_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when institution revoked the certificate",
    )

    # ============================================================
    # Timestamps
    # ============================================================
    
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When this record was created",
    )
    
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="When this record was last updated",
    )

    # ============================================================
    # Meta
    # ============================================================
    
    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["applicant", "institution"]),
            models.Index(fields=["applicant_id_hash"]),
            models.Index(fields=["contract_address"]),
            models.Index(fields=["national_id_plain"]),
        ]
        # ✅ ADDED: Explicit constraint for duplicate prevention
        constraints = [
            models.UniqueConstraint(
                fields=['file_hash'],
                name='unique_certificate_file_hash',
                condition=models.Q(file_hash__isnull=False) & ~models.Q(file_hash=''),
            )
        ]
        verbose_name = "Certificate"
        verbose_name_plural = "Certificates"

    def __str__(self) -> str:
        return f"{self.display_label} - {self.applicant.full_name}"
    
    # ============================================================
    # Methods
    # ============================================================
    
    def save(self, *args, **kwargs):
        if self.applicant and not self.national_id_plain:
            self.national_id_plain = self.applicant.national_id_plain
        super().save(*args, **kwargs)
    
    @property
    def blockchain_url(self):
        if not self.tx_hash:
            return None
        return f"https://etherscan.io/tx/{self.tx_hash}"
    
    @property
    def is_on_blockchain(self):
        return bool(self.tx_hash and self.block_number and self.contract_address)