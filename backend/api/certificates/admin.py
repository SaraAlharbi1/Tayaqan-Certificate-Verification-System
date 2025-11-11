# backend/api/certificates/admin.py
from django.contrib import admin
from .models import Certificate

@admin.register(Certificate)
class CertificateAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "display_label",
        "applicant",
        "institution",
        "serial_number",
        "issued_on",
        "created_at",
    )
    # remove status-based filters; keep useful ones
    list_filter = ("institution", "issued_on", "created_at")
    search_fields = ("display_label", "serial_number", "file_hash", "applicant__full_name")
    ordering = ("-created_at",)
