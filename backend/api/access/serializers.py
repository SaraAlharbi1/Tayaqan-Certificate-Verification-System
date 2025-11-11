# backend/api/access/serializers.py

from rest_framework import serializers
from .models import AccessRequest, AccessShare
from api.certificates.serializers import CertificateListSerializer


class AccessRequestCreateSerializer(serializers.ModelSerializer):
    """Employer creates access request"""
    
    applicant_national_id = serializers.CharField(write_only=True)

    class Meta:
        model = AccessRequest
        fields = ["id", "applicant_national_id", "note", "status", "created_at"]
        read_only_fields = ["id", "status", "created_at"]

    def validate(self, attrs):
        request = self.context["request"]
        employer = getattr(request.user, "employer", None)
        
        if employer is None:
            raise serializers.ValidationError("Employer account required.")
        
        if getattr(employer, "status", "APPROVED") not in ("PENDING", "APPROVED"):
            raise serializers.ValidationError("Employer status not allowed.")

        from api.accounts.models import Applicant
        try:
            applicant = Applicant.objects.get(
                national_id_plain=attrs["applicant_national_id"]
            )
        except Applicant.DoesNotExist:
            raise serializers.ValidationError("Applicant not found.")

        attrs["employer"] = employer
        attrs["applicant"] = applicant
        return attrs

    def create(self, validated):
        validated.pop("applicant_national_id", None)
        return AccessRequest.objects.create(**validated)


class EmployerAccessRequestListItemSerializer(serializers.ModelSerializer):
    """Employer's request list view"""
    
    applicant_name = serializers.SerializerMethodField()
    applicant_id = serializers.SerializerMethodField()

    class Meta:
        model = AccessRequest
        fields = ["id", "status", "created_at", "applicant_name", "applicant_id"]

    def get_applicant_name(self, obj):
        return getattr(obj.applicant, "full_name", "")

    def get_applicant_id(self, obj):
        return getattr(obj.applicant, "national_id_plain", "")


class ApplicantAccessRequestListItemSerializer(serializers.ModelSerializer):
    """Applicant's request list view"""
    
    company = serializers.SerializerMethodField()
    applicant_id = serializers.SerializerMethodField()

    class Meta:
        model = AccessRequest
        fields = ["id", "status", "created_at", "company", "applicant_id"]

    def get_company(self, obj):
        return getattr(obj.employer, "company_name", "") or "—"

    def get_applicant_id(self, obj):
        return getattr(obj.applicant, "national_id_plain", "")


class AccessRequestDetailSerializer(serializers.ModelSerializer):
    """Detailed request view"""
    
    applicant_name = serializers.SerializerMethodField()
    applicant_id = serializers.SerializerMethodField()
    company = serializers.SerializerMethodField()
    shares = serializers.SerializerMethodField()

    class Meta:
        model = AccessRequest
        fields = [
            "id", "status", "created_at", "decided_at",
            "applicant_name", "applicant_id", "company", "shares"
        ]

    def get_applicant_name(self, obj):
        return getattr(obj.applicant, "full_name", "")

    def get_applicant_id(self, obj):
        return getattr(obj.applicant, "national_id_plain", "")

    def get_company(self, obj):
        return getattr(obj.employer, "company_name", "") or "—"

    def get_shares(self, obj):
        certs = [s.certificate for s in obj.shares.select_related("certificate")]
        return CertificateListSerializer(certs, many=True).data


class AccessApproveSerializer(serializers.Serializer):
    """Payload for approving request"""
    
    certificate_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False
    )