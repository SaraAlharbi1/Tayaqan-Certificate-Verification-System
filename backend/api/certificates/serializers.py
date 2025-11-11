# backend/api/certificates/serializers.py
"""Serializers for certificate listing and detail (no non-model fields)."""

from rest_framework import serializers
from .models import Certificate


class CertificateListSerializer(serializers.ModelSerializer):
    """Institution list view; safe model-only fields."""
    applicant_name = serializers.CharField(source="applicant.full_name", read_only=True)
    institution_name = serializers.CharField(source="institution.institution_name", read_only=True)

    class Meta:
        model = Certificate
        fields = (
            "id",
            "display_label",
            "serial_number",
            "issued_on",
            "file_hash",
            "applicant_name",
            "institution_name",
        )


class MyCertificateListSerializer(serializers.ModelSerializer):
    """Applicant list view; safe model-only fields."""
    issuerName = serializers.CharField(source="institution.institution_name", read_only=True)

    class Meta:
        model = Certificate
        fields = (
            "id",
            "display_label",
            "serial_number",
            "issued_on",
            "file_hash",
            "issuerName",
        )


class CertificateDetailSerializer(serializers.ModelSerializer):
    """Detail view; excludes encryption material."""
    applicant = serializers.SerializerMethodField()
    institution = serializers.SerializerMethodField()

    class Meta:
        model = Certificate
        fields = (
            "id",
            "display_label",
            "serial_number",
            "issued_on",
            "file_hash",
            "applicant",
            "institution",
        )

    def get_applicant(self, obj):
        a = obj.applicant
        return {
            "id": a.id,
            "full_name": getattr(a, "full_name", None),
            "national_id": getattr(a, "national_id_plain", None),
        }

    def get_institution(self, obj):
        i = obj.institution
        return {
            "id": i.id,
            "name": getattr(i, "institution_name", None),
            "official_email": getattr(i, "official_email", None),
        }
