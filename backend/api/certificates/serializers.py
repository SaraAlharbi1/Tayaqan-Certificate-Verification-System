# backend/api/certificates/serializers.py
from rest_framework import serializers
from .models import Certificate

# -------- Institution-facing (unchanged behavior) --------
class CertificateListSerializer(serializers.ModelSerializer):
    applicant = serializers.SerializerMethodField()

    class Meta:
        model = Certificate
        fields = [
            "id",
            "display_label",
            "issued_on",
            "status",
            "serial_number",
            "file_hash",
            "tx_hash",
            "block_number",
            "revoke_tx_hash",
            "revoke_block_number",
            "applicant",
            "created_at",
        ]

    def get_applicant(self, obj):
        a = obj.applicant
        return {
            "id": a.id,
            "name": getattr(a, "full_name", "") or getattr(a, "name", ""),
            "national_id": getattr(a, "national_id_plain", None),
        }


class CertificateDetailSerializer(serializers.ModelSerializer):
    applicant = serializers.SerializerMethodField()

    class Meta:
        model = Certificate
        fields = [
            "id",
            "display_label",
            "issued_on",
            "status",
            "file_hash",
            "cid_enc",
            "tx_hash",
            "block_number",
            "revoke_tx_hash",
            "revoke_block_number",
            "serial_number",
            "applicant",
            "created_at",
            "updated_at",
        ]

    def get_applicant(self, obj):
        a = obj.applicant
        return {
            "id": a.id,
            "name": getattr(a, "full_name", "") or getattr(a, "name", ""),
            "national_id": getattr(a, "national_id_plain", None),
        }

# -------- Applicant-facing (new) --------
class MyCertificateListSerializer(serializers.ModelSerializer):
    title = serializers.CharField(source="display_label")
    issueDate = serializers.DateField(source="issued_on", format="%Y-%m-%d")
    serial = serializers.CharField(source="serial_number")
    is_revoked = serializers.SerializerMethodField()
    issuerName = serializers.SerializerMethodField()

    class Meta:
        model = Certificate
        fields = ["id", "title", "issuerName", "issueDate", "serial", "is_revoked"]

    def get_is_revoked(self, obj):
        return bool(getattr(obj, "revoke_tx_hash", None)) or str(getattr(obj, "status", "")).upper() == "REVOKED"

    def get_issuerName(self, obj):
        inst = getattr(obj, "institution", None)
        if not inst:
            return "—"
        return getattr(inst, "institution_name", "—")


class MyCertificateDetailSerializer(serializers.ModelSerializer):
    title = serializers.CharField(source="display_label")
    issueDate = serializers.DateField(source="issued_on", format="%Y-%m-%d")
    serial = serializers.CharField(source="serial_number")
    is_revoked = serializers.SerializerMethodField()
    issuerName = serializers.SerializerMethodField()

    class Meta:
        model = Certificate
        fields = [
            "id", "title", "issuerName", "issueDate", "serial", "status",
            "file_hash", "cid_enc", "tx_hash", "block_number",
            "revoke_tx_hash", "revoke_block_number",
            "created_at", "updated_at", "is_revoked",
        ]

    def get_is_revoked(self, obj):
        return bool(getattr(obj, "revoke_tx_hash", None)) or str(getattr(obj, "status", "")).upper() == "REVOKED"

    def get_issuerName(self, obj):
        return getattr(obj.institution, "institution_name", "—") if getattr(obj, "institution", None) else "—"