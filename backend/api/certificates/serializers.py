"""Serializers for certificate issuance and retrieval."""

from rest_framework import serializers
from .models import Certificate
from .validators import validate_pdf_file


# ================================
# Institution: Issue Certificate
# ================================

class PrepareIssueSerializer(serializers.Serializer):
    """
    Step 1: Upload PDF + prepare blockchain data.
    Institution gets hash to sign with MetaMask.
    """
    national_id = serializers.CharField(max_length=20)
    full_name = serializers.CharField(max_length=255)
    title = serializers.CharField(max_length=500)
    certificate_type = serializers.CharField(max_length=255)
    issued_on = serializers.DateField(required=False, allow_null=True)
    pdf_file = serializers.FileField()

    def validate_pdf_file(self, value):
        validate_pdf_file(value)
        return value


class ConfirmIssueSerializer(serializers.Serializer):
    """
    Step 2: Confirm blockchain transaction.
    Saves certificate to database with blockchain proof.
    
    ✅ UPDATED: Now validates that file_hash is unique (no duplicates)
    """
    national_id = serializers.CharField(max_length=20)
    title = serializers.CharField(max_length=500)
    certificate_type = serializers.CharField(max_length=255)
    issued_on = serializers.DateField(required=False, allow_null=True)
    cid = serializers.CharField(max_length=255)
    file_hash = serializers.CharField(max_length=66)
    applicant_id_hash = serializers.CharField(max_length=66)
    contract_address = serializers.CharField(max_length=42)
    tx_hash = serializers.CharField(max_length=66)
    block_number = serializers.IntegerField(required=False, allow_null=True)

    # ✅ ADDED: Validate that file_hash is unique
    def validate_file_hash(self, value):
        """
        Check if certificate with this file hash already exists.
        Prevents duplicate certificates from being issued.
        """
        if not value:
            return value
        
        existing = Certificate.objects.filter(file_hash=value).first()
        if existing:
            raise serializers.ValidationError(
                f"A certificate with this file already exists (ID: {existing.id}). "
                f"Duplicate certificates are not allowed."
            )
        return value

    # ✅ ADDED: Validate that tx_hash is unique
    def validate_tx_hash(self, value):
        """
        Check if certificate with this transaction hash already exists.
        Prevents duplicate blockchain transactions from being recorded.
        """
        if not value:
            return value
        
        existing = Certificate.objects.filter(tx_hash=value).first()
        if existing:
            raise serializers.ValidationError(
                f"A certificate with this transaction already exists (ID: {existing.id}). "
                f"This transaction has already been recorded."
            )
        return value


# ================================
# Institution: List/Detail
# ================================

class CertificateListSerializer(serializers.ModelSerializer):
    """
    List view for institution's issued certificates.
    Includes basic info + blockchain status.
    """
    applicant_full_name = serializers.CharField(source="applicant.full_name")
    applicant_national_id_plain = serializers.SerializerMethodField()
    institution_name = serializers.CharField(source="institution.institution_name")

    class Meta:
        model = Certificate
        fields = (
            "id",
            "display_label",
            "issued_on",
            "applicant_full_name",
            "applicant_national_id_plain",
            "institution_name",
            "file_hash",
            "contract_address",
            "tx_hash",
            "block_number",
            "created_at",
        )
    
    def get_applicant_national_id_plain(self, obj):
        """Get national ID from denormalized field or applicant relation."""
        return obj.national_id_plain or obj.applicant.national_id_plain


class CertificateDetailSerializer(serializers.ModelSerializer):
    """
    Detail view for institution.
    Includes all certificate data + blockchain proof.
    """
    applicant_full_name = serializers.CharField(source="applicant.full_name")
    applicant_national_id_plain = serializers.SerializerMethodField()
    applicant_wallet_address = serializers.CharField(source="applicant.wallet_address")
    institution_name = serializers.CharField(source="institution.institution_name")
    institution_id = serializers.CharField(source="institution.institution_id")

    class Meta:
        model = Certificate
        fields = (
            "id",
            "display_label",
            "issued_on",
            "applicant_full_name",
            "applicant_national_id_plain",
            "applicant_wallet_address",
            "institution_name",
            "institution_id",
            "file_hash",
            "applicant_id_hash",
            "contract_address",
            "tx_hash",
            "block_number",
            "revoke_tx_hash",
            "revoke_block_number",
            "revoked_at",
            "created_at",
            "updated_at",
        )
    
    def get_applicant_national_id_plain(self, obj):
        return obj.national_id_plain or obj.applicant.national_id_plain


# ================================
# Applicant: My Certificates
# ================================

class MyCertificateListSerializer(serializers.ModelSerializer):
    """
    List view for applicant's certificates.
    Shows who issued it and blockchain status.
    """
    institution_name = serializers.CharField(source="institution.institution_name")

    class Meta:
        model = Certificate
        fields = (
            "id",
            "display_label",
            "issued_on",
            "institution_name",
            "file_hash",
            "tx_hash",
            "block_number",
            "created_at",
        )


class MyCertificateDetailSerializer(serializers.ModelSerializer):
    """
    Detail view for applicant.
    Full certificate info with blockchain proof.
    """
    institution_name = serializers.CharField(source="institution.institution_name")
    institution_id = serializers.CharField(source="institution.institution_id")
    applicant_national_id_plain = serializers.SerializerMethodField()

    class Meta:
        model = Certificate
        fields = (
            "id",
            "display_label",
            "issued_on",
            "institution_name",
            "institution_id",
            "applicant_national_id_plain",
            "file_hash",
            "applicant_id_hash",
            "contract_address",
            "tx_hash",
            "block_number",
            "revoke_tx_hash",
            "revoke_block_number",
            "revoked_at",
            "created_at",
        )
    
    def get_applicant_national_id_plain(self, obj):
        return obj.national_id_plain or obj.applicant.national_id_plain


# ================================
# Blockchain Verification
# ================================

class VerifyBatchRequestSerializer(serializers.Serializer):
    """
    Request to verify multiple certificates on blockchain.
    """
    file_hashes = serializers.ListField(
        child=serializers.CharField(),
        help_text="List of certificate file hashes to verify"
    )


class CertificateVerificationSerializer(serializers.Serializer):
    """
    Blockchain verification result for a single certificate.
    """
    file_hash = serializers.CharField(help_text="Certificate hash (key in smart contract)")
    exists = serializers.BooleanField(help_text="Certificate exists on blockchain")
    certificate_type = serializers.CharField(help_text="Certificate type from blockchain")
    issue_date = serializers.IntegerField(help_text="Issue timestamp from blockchain")
    is_revoked = serializers.BooleanField(help_text="Certificate revoked status")


class VerifyBatchResponseSerializer(serializers.Serializer):
    """
    Response from batch verification.
    """
    results = CertificateVerificationSerializer(many=True)


# ================================
# Revocation
# ================================

class RevokeRequestSerializer(serializers.Serializer):
    """
    Request to revoke a certificate (institution only).
    """
    reason = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Optional reason for revocation"
    )


class RevokeResponseSerializer(serializers.Serializer):
    """
    Response from certificate revocation.
    """
    success = serializers.BooleanField()
    tx_hash = serializers.CharField(required=False)
    block_number = serializers.IntegerField(required=False)
    error = serializers.CharField(required=False)