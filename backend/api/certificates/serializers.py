# backend/api/certificates/serializers.py
from rest_framework import serializers
from .models import Certificate


class ApplicantMiniSerializer(serializers.Serializer):
    id = serializers.IntegerField(source="applicant.id", read_only=True)
    name = serializers.CharField(source="applicant.full_name", read_only=True)
    national_id_plain = serializers.CharField(
        source="applicant.national_id_plain", read_only=True
    )


class CertificateListSerializer(serializers.ModelSerializer):
    """
    Fast list serializer (no chain checks).
    """
    applicant = ApplicantMiniSerializer(source="*", read_only=True)
    institution_name = serializers.CharField(
        source="institution.institution_name", read_only=True, required=False
    )
    # Flat national ID for list UIs
    applicant_national_id_plain = serializers.CharField(
        source="applicant.national_id_plain", read_only=True
    )

    class Meta:
        model = Certificate
        fields = [
            "id",
            "display_label",
            "issued_on",
            "serial_number",
            "file_hash",
            "applicant",
            "applicant_national_id_plain",
            "institution_name",
            "created_at",
        ]


class CertificateDetailSerializer(serializers.ModelSerializer):
    """
    Detail for Institution/Employer routes.
    """
    applicant = ApplicantMiniSerializer(source="*", read_only=True)
    institution_name = serializers.CharField(
        source="institution.institution_name", read_only=True
    )
    # Flat national ID for detail UIs
    applicant_national_id_plain = serializers.CharField(
        source="applicant.national_id_plain", read_only=True
    )

    class Meta:
        model = Certificate
        fields = [
            "id",
            "display_label",
            "issued_on",
            "file_hash",
            "cid_enc",
            "enc_nonce",
            "enc_tag",
            "enc_key_protected",
            "serial_number",
            "applicant",
            "applicant_national_id_plain",
            "institution_name",
            "created_at",
            "updated_at",
        ]


class MyCertificateListSerializer(serializers.ModelSerializer):
    institution_name = serializers.CharField(
        source="institution.institution_name", read_only=True
    )

    class Meta:
        model = Certificate
        fields = [
            "id",
            "display_label",
            "issued_on",
            "serial_number",
            "file_hash",
            "institution_name",
            "created_at",
        ]


class MyCertificateDetailSerializer(CertificateDetailSerializer):
    class Meta(CertificateDetailSerializer.Meta):
        pass
