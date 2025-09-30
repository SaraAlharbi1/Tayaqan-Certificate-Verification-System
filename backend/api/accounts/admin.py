from django import forms
from django.db import models
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.utils.html import format_html
from .models import User, Applicant, Employer, Institution

# ---- Users ----
@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    model = User
    ordering = ("id",)
    list_display = ("email", "role", "is_active", "is_staff", "last_login")
    list_filter  = ("role", "is_active", "is_staff")
    search_fields = ("email",)
    exclude = ("username", "first_name", "last_name")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Role", {"fields": ("role",)}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = ((None, {"classes": ("wide",), "fields": ("email","password1","password2","role","is_active","is_staff","is_superuser")}),)

# helper
def _proof_link(filefield):
    if filefield and getattr(filefield, "url", None):
        return format_html('<a href="{}" target="_blank">Download PDF</a>', filefield.url)
    return "—"

# ---- Applicants (signup fields) ----
@admin.register(Applicant)
class ApplicantAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "full_name", "national_id_plain", "phone")
    search_fields = ("user__email", "full_name", "national_id_plain")

# ---- Employers (signup fields) ----
@admin.register(Employer)
class EmployerAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "full_name", "company_name", "cr_number_plain",
                    "work_email", "phone", "status", "status_notes", "proof_link")
    list_display_links = ("id", "user")
    list_editable = ("status", "status_notes")
    list_filter = ("status",)
    search_fields = ("user__email", "full_name", "company_name", "cr_number_plain")

    formfield_overrides = {models.TextField: {"widget": forms.Textarea(attrs={"rows": 2})}}
    readonly_fields = ("proof_link",)

    @admin.display(description="Proof")
    def proof_link(self, obj): return _proof_link(obj.proof_doc)

# ---- Institutions (signup fields) ----
@admin.register(Institution)
class InstitutionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "institution_name", "official_email", "department",
                    "phone", "status", "status_notes", "proof_link")
    list_display_links = ("id", "user")
    list_editable = ("status", "status_notes")
    list_filter = ("status",)
    search_fields = ("user__email", "institution_name", "official_email")

    formfield_overrides = {models.TextField: {"widget": forms.Textarea(attrs={"rows": 2})}}
    readonly_fields = ("proof_link",)

    @admin.display(description="Proof")
    def proof_link(self, obj): return _proof_link(obj.proof_doc)
