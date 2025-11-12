# backend/api/access/serializers.py
"""Serializers for access requests and approvals."""
from django.db import transaction
from rest_framework import serializers

from api.accounts.models import Applicant, Employer
from api.accounts.utils import normalize_national_id
from api.accounts.validators import is_national_id_10_digits
from .models import AccessRequest, AccessShare


class AccessRequestSerializer(serializers.ModelSerializer):
    """List/detail rows shown in the Access Requests table."""
    employer_name = serializers.CharField(source="employer.company_name", read_only=True)
    applicant_name = serializers.CharField(source="applicant.full_name", read_only=True)
    # >>> THIS is the National ID (not DB id)
    national_id_plain = serializers.CharField(source="applicant.national_id_plain", read_only=True)

    class Meta:
        model = AccessRequest
        fields = [
            "id",                # request id (keep if you show it anywhere)
            "status",
            "created_at",
            "decided_at",
            "employer_name",
            "applicant_name",
            "national_id_plain",  # <- applicant’s National ID
        ]


class AccessRequestCreateSerializer(serializers.Serializer):
    """Employer creates request by applicant national ID."""
    applicant_national_id = serializers.CharField()

    def validate(self, attrs):
        request = self.context["request"]
        employer = getattr(request.user, "employer", None)
        if not employer:
            raise serializers.ValidationError("Employer account required.")
        if employer.status != Employer.Status.APPROVED:
            raise serializers.ValidationError("Employer must be approved.")

        nid = normalize_national_id(attrs.get("applicant_national_id", ""))
        if not is_national_id_10_digits(nid):
            raise serializers.ValidationError("Invalid national ID.")
        try:
            applicant = Applicant.objects.get(national_id_plain=nid)
        except Applicant.DoesNotExist:
            raise serializers.ValidationError("Applicant not found.")

        attrs["employer"] = employer
        attrs["applicant"] = applicant
        attrs["applicant_national_id"] = nid
        return attrs

    @transaction.atomic
    def create(self, validated):
        # unique constraint will block duplicate pending requests
        return AccessRequest.objects.create(
            employer=validated["employer"],
            applicant=validated["applicant"],
        )


class AccessApproveSerializer(serializers.Serializer):
    """Applicant approves and selects certificates to share."""
    certificate_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
    )

    def validate_certificate_ids(self, ids):
        # de-dup and keep order
        seen, out = set(), []
        for i in ids:
            if i not in seen:
                out.append(i)
                seen.add(i)
        return out


class AccessShareSerializer(serializers.ModelSerializer):
    """Returned after approval."""
    file_hash = serializers.CharField(source="certificate.file_hash", read_only=True)
    title = serializers.CharField(source="certificate.display_label", read_only=True)
    issued_on = serializers.DateField(source="certificate.issued_on", read_only=True)
    issuer = serializers.CharField(source="certificate.institution.institution_name", read_only=True)

    class Meta:
        model = AccessShare
        fields = ["id", "file_hash", "title", "issued_on", "issuer", "created_at"]
