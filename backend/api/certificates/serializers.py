# backend/api/certificates/serializers.py
from __future__ import annotations

from rest_framework import serializers

# Adjust these imports to your actual app layout
from .models import Certificate  # Certificate has FKs: applicant, institution


# ========== Common related-field helpers ==========

class ApplicantMiniSerializer(serializers.Serializer):
    full_name = serializers.CharField(read_only=True)
    national_id_plain = serializers.CharField(read_only=True)


class InstitutionMiniSerializer(serializers.Serializer):
    institution_name = serializers.CharField(read_only=True)


# ========== Institution: LIST ==========

class CertificateListSerializer(serializers.ModelSerializer):
    """
    Used by: GET /institution/certificates/
    - Adds applicant_full_name and national_id_plain for the table
    - Adds institution_name for completeness
    """
    applicant_full_name = serializers.CharField(source="applicant.full_name", read_only=True)
    national_id_plain = serializers.CharField(source="applicant.national_id_plain", read_only=True)
    institution_name = serializers.CharField(source="institution.institution_name", read_only=True)

    class Meta:
        model = Certificate
        fields = (
            "id",
            "display_label",          # title on FE
            "serial_number",
            "issued_on",
            "file_hash",
            # added for FE table:
            "applicant_full_name",
            "national_id_plain",
            "institution_name",
        )


# ========== Institution: DETAIL ==========

class CertificateDetailSerializer(serializers.ModelSerializer):
    """
    Used by: GET /institution/certificates/{id}/
    - Provides fields the FE normalizer expects:
        title/display_label, issued_on, serial_number
        applicant_full_name / national_id_plain
        issuer/institution name
        chain meta if you annotate it in the ViewSet (status/tx/revoke…)
    """
    # Applicant
    applicant_full_name = serializers.CharField(source="applicant.full_name", read_only=True)
    national_id_plain = serializers.CharField(source="applicant.national_id_plain", read_only=True)

    # Institution (issuer)
    institution_name = serializers.CharField(source="institution.institution_name", read_only=True)

    # Optional on-chain meta (these may be annotated in queryset or returned via @action)
    status = serializers.CharField(read_only=True, required=False)
    tx_hash = serializers.CharField(read_only=True, required=False, allow_null=True)
    block_number = serializers.IntegerField(read_only=True, required=False, allow_null=True)
    revoke_tx_hash = serializers.CharField(read_only=True, required=False, allow_null=True)
    revoke_block_number = serializers.IntegerField(read_only=True, required=False, allow_null=True)

    class Meta:
        model = Certificate
        fields = (
            "id",
            "display_label",          # FE maps to title
            "serial_number",
            "issued_on",
            "file_hash",

            # parties
            "applicant_full_name",
            "national_id_plain",
            "institution_name",

            # optional chain/meta (if annotated)
            "status",
            "tx_hash",
            "block_number",
            "revoke_tx_hash",
            "revoke_block_number",
        )


# ========== Applicant: LIST/DETAIL (optional) ==========

class MyCertificateListSerializer(serializers.ModelSerializer):
    """
    If you list applicant-owned certs at /my/certificates/.
    Keep minimal — FE only needs id, title/display_label, serial, issue date.
    """
    title = serializers.CharField(source="display_label", read_only=True)

    class Meta:
        model = Certificate
        fields = ("id", "title", "serial_number", "issued_on")


class MyCertificateDetailSerializer(serializers.ModelSerializer):
    """
    If you serve /my/certificates/{id}/ the FE expects:
      - title (display_label), serial_number, issued_on
      - issuer/institution name (issuerName)
      - chain meta: status, tx_hash, block_number, revoke_* (if available)
      - nested applicant (optional)
    """
    title = serializers.CharField(source="display_label", read_only=True)
    issuerName = serializers.CharField(source="institution.institution_name", read_only=True)

    # expose both flat and nested applicant info; FE will read either
    applicant = ApplicantMiniSerializer(source="applicant", read_only=True)
    national_id_plain = serializers.CharField(source="applicant.national_id_plain", read_only=True)

    # optional chain/meta (if annotated in the view)
    status = serializers.CharField(read_only=True, required=False)
    tx_hash = serializers.CharField(read_only=True, required=False, allow_null=True)
    block_number = serializers.IntegerField(read_only=True, required=False, allow_null=True)
    revoke_tx_hash = serializers.CharField(read_only=True, required=False, allow_null=True)
    revoke_block_number = serializers.IntegerField(read_only=True, required=False, allow_null=True)

    class Meta:
        model = Certificate
        fields = (
            "id",
            "title",
            "serial_number",
            "issued_on",
            "file_hash",

            "issuerName",
            "applicant",
            "national_id_plain",

            "status",
            "tx_hash",
            "block_number",
            "revoke_tx_hash",
            "revoke_block_number",
        )
