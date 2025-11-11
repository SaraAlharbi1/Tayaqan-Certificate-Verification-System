# backend/api/accounts/admin.py
from django import forms
from django.db import models
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.utils.html import format_html, strip_tags
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string

from .models import User, Applicant, Employer, Institution

# ---- Users ----
@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    model = User
    ordering = ("id",)
    list_display = ("email", "role", "is_active", "is_staff", "last_login")
    list_filter = ("role", "is_active", "is_staff")
    search_fields = ("email",)
    exclude = ("username", "first_name", "last_name")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Role", {"fields": ("role",)}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "password1", "password2", "role", "is_active", "is_staff", "is_superuser"),
        }),
    )

# helpers
def _proof_link(filefield):
    if filefield and getattr(filefield, "url", None):
        return format_html('<a href="{}" target="_blank">Download PDF</a>', filefield.url)
    return "—"

def _notify_status_change(kind, obj, to_email):
    """Send status change email using the existing template at:
       backend/api/accounts/templates/Registration_update.html
    """
    if not to_email:
        return
    ctx = {
        "kind": kind,  # "institution" | "employer"
        "name": getattr(obj, "institution_name", None) or getattr(obj, "full_name", ""),
        "status": (obj.status or "").lower(),
        "notes": (obj.status_notes or "").strip(),
        "dashboard_url": "http://localhost:5173/login",
    }
    # Use the single HTML template you have; derive text from it.
    html_body = render_to_string("Registration_update.html", ctx)
    text_body = strip_tags(html_body)
    send_mail(
        subject="Tayaqan Registration Status Updated",
        message=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[to_email],
        html_message=html_body,
        fail_silently=True,
    )

# ---- Applicants (signup fields) ----
@admin.register(Applicant)
class ApplicantAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "full_name", "national_id_plain", "phone")
    search_fields = ("user__email", "full_name", "national_id_plain")

# ---- Employers (signup fields) ----
@admin.register(Employer)
class EmployerAdmin(admin.ModelAdmin):
    list_display = (
        "id", "user", "full_name", "company_name", "cr_number_plain",
        "work_email", "phone", "status", "status_notes", "proof_link",
    )
    list_display_links = ("id", "user")
    list_editable = ("status", "status_notes")
    list_filter = ("status",)
    search_fields = ("user__email", "full_name", "company_name", "cr_number_plain")

    formfield_overrides = {models.TextField: {"widget": forms.Textarea(attrs={"rows": 2})}}
    readonly_fields = ("proof_link",)

    @admin.display(description="Proof")
    def proof_link(self, obj):
        return _proof_link(obj.proof_doc)

    def save_model(self, request, obj, form, change):
        old_status = None
        if obj.pk:
            old_status = Employer.objects.get(pk=obj.pk).status
        super().save_model(request, obj, form, change)
        if change and obj.status != old_status:
            _notify_status_change("employer", obj, obj.work_email)

# ---- Institutions (signup fields) ----
@admin.register(Institution)
class InstitutionAdmin(admin.ModelAdmin):
    list_display = (
        "id", "user", "institution_name", "official_email", "department",
        "phone", "status", "status_notes", "proof_link",
    )
    list_display_links = ("id", "user")
    list_editable = ("status", "status_notes")
    list_filter = ("status",)
    search_fields = ("user__email", "institution_name", "official_email")

    formfield_overrides = {models.TextField: {"widget": forms.Textarea(attrs={"rows": 2})}}
    readonly_fields = ("proof_link",)

    @admin.display(description="Proof")
    def proof_link(self, obj):
        return _proof_link(obj.proof_doc)

    def save_model(self, request, obj, form, change):
        old_status = None
        if obj.pk:
            old_status = Institution.objects.get(pk=obj.pk).status
        super().save_model(request, obj, form, change)
        if change and obj.status != old_status:
            _notify_status_change("institution", obj, obj.official_email)
