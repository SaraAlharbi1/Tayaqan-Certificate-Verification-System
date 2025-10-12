# certificates/admin.py
from django.contrib import admin
from .models import Certificate

@admin.register(Certificate)
class CertificateAdmin(admin.ModelAdmin):
    list_display = ("id", "institution", "applicant", "display_label", "issued_on", "status", "tx_hash")
    list_filter = ("status", "institution")
    search_fields = ("display_label", "file_hash", "tx_hash")
