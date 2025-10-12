from django.db import models
from django.conf import settings


class Certificate(models.Model):
    STATUS_CHOICES = [
        ("STORED_OFFCHAIN", "Stored off-chain only"),
        ("ISSUED_ONCHAIN", "Issued on-chain"),
        ("FAILED_ONCHAIN", "Failed on-chain"),
        ("REVOKED", "Revoked"),
    ]

    # Ownership / subject
    institution = models.ForeignKey("accounts.Institution", on_delete=models.CASCADE)
    applicant = models.ForeignKey("accounts.Applicant", on_delete=models.CASCADE)
    created_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )

    # Integrity + storage (encrypted file on Storacha/IPFS)
    file_hash = models.CharField(max_length=66)  # keccak256 hex (0x + 64)
    cid_enc = models.TextField()  # encrypted PDF CID

    # Crypto envelope (needed to decrypt the PDF)
    enc_nonce = models.CharField(max_length=64)  # hex
    enc_tag = models.CharField(max_length=64)  # hex
    enc_key_protected = models.TextField()  # hex

    # Minimal display fields
    display_label = models.CharField(
        max_length=120, null=True, blank=True
    )  # certificate title
    issued_on = models.DateField(null=True, blank=True)  # issued at
    serial_number = models.CharField(
        max_length=64, blank=True, null=True, db_index=True
    )

    # On-chain bookkeeping
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="STORED_OFFCHAIN"
    )
    tx_hash = models.CharField(max_length=66, null=True, blank=True)
    block_number = models.IntegerField(null=True, blank=True)

    # Revoke bookkeeping (optional)
    revoke_tx_hash = models.CharField(max_length=66, null=True, blank=True)
    revoke_block_number = models.IntegerField(null=True, blank=True)

    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["institution", "file_hash"],
                name="uniq_cert_institution_filehash",
            )
        ]

    def __str__(self):
        label = self.display_label or self.file_hash[:10]
        return f"Cert {self.id} - {label}"
