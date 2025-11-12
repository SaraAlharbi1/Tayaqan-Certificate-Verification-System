# backend/api/access/serializers.py
"""Serializers for access requests and approvals."""

from django.db import transaction
from rest_framework import serializers

from api.accounts.models import Applicant, Employer
from api.accounts.utils import normalize_national_id
from api.accounts.validators import is_national_id_10_digits
from .models import AccessRequest, AccessShare


class AccessRequestSerializer(serializers.ModelSerializer):
    """
    Access request row shown in tables.

    Canonical fields:
      - employer_name: company name of the requesting employer
      - applicant_name: full name of the applicant
      - national_id_plain: applicant’s national ID (display-only)

    Compatibility aliases (avoid frontend changes):
      - company_name: alias for employer_name
      - applicant_id: alias for national_id_plain
    """

    # Canonical
    employer_name = serializers.CharField(source="employer.company_name", read_only=True)
    applicant_name = serializers.CharField(source="applicant.full_name", read_only=True)
    national_id_plain = serializers.CharField(source="applicant.national_id_plain", read_only=True)

    # Aliases (keep UI stable)
    company_name = serializers.CharField(source="employer.company_name", read_only=True)
    applicant_id = serializers.CharField(source="applicant.national_id_plain", read_only=True)

    class Meta:
        model = AccessRequest
        fields = [
            "id",
            "status",
            "created_at",
            "decided_at",
            # canonical
            "employer_name",
            "applicant_name",
            "national_id_plain",
            # aliases
            "company_name",
            "applicant_id",
        ]


class AccessRequestCreateSerializer(serializers.Serializer):
    """
    Employer creates a request by providing the applicant’s national ID.
    Validates employer status and the applicant’s existence.
    """
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
        # Unique DB constraint prevents duplicate pending requests.
        return AccessRequest.objects.create(
            employer=validated["employer"],
            applicant=validated["applicant"],
        )


class AccessApproveSerializer(serializers.Serializer):
    """
    Applicant approves a request by selecting certificate IDs.
    Input is de-duplicated while preserving order.
    """
    certificate_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
    )

    def validate_certificate_ids(self, ids):
        seen, out = set(), []
        for i in ids:
            if i not in seen:
                out.append(i)
                seen.add(i)
        return out


class AccessShareSerializer(serializers.ModelSerializer):
    """
    A single share created after approval.
    Provides minimal certificate display fields for lists.
    """
    file_hash = serializers.CharField(source="certificate.file_hash", read_only=True)
    title = serializers.CharField(source="certificate.display_label", read_only=True)
    issued_on = serializers.DateField(source="certificate.issued_on", read_only=True)
    issuer = serializers.CharField(source="certificate.institution.institution_name", read_only=True)

    class Meta:
        model = AccessShare
        fields = ["id", "file_hash", "title", "issued_on", "issuer", "created_at"]
