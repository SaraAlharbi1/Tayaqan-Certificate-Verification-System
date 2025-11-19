"""Django admin for certificates."""

from django.contrib import admin
from .models import Certificate


@admin.register(Certificate)
class CertificateAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "display_label",
        "institution",
        "applicant",
        "issued_on",
        "created_at",
    )
    list_filter = ("institution", "issued_on", "created_at")
    search_fields = (
        "display_label",
        "applicant__full_name",
        "applicant__national_id_plain",
        "institution__institution_name",
    )
    readonly_fields = ("file_cid", "applicant_id_hash", "created_at", "updated_at")
    
    fieldsets = (
        ("Certificate Info", {
            "fields": ("display_label", "issued_on")
        }),
        ("Parties", {
            "fields": ("institution", "applicant", "created_by_user")
        }),
        ("Storage & Blockchain", {
            "fields": ("file_cid", "applicant_id_hash")
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        }),
    )