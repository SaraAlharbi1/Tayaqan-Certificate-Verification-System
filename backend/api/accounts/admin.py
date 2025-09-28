"""
Django admin registrations for quick internal moderation.

Why admin?
----------
Gives you an immediate back office to:
- inspect users and profiles,
- approve/reject employers/institutions,
- debug data without building custom screens yet.
"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Applicant, Employer, Institution


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Admin list for Users: email, role, and flags."""
    model = User
    list_display = ("id", "email", "role", "is_active", "is_staff")
    list_filter = ("role", "is_active", "is_staff")
    ordering = ("id",)
    search_fields = ("email",)
    fieldsets = (
        (None, {"fields": ("email", "password", "role")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "role", "password1", "password2", "is_staff", "is_superuser")}),
    )


@admin.register(Applicant)
class ApplicantAdmin(admin.ModelAdmin):
    """Quick view of Applicants; search by email, name, or national_id_plain/hash."""
    list_display = ("id", "user", "full_name", "national_id_plain")
    search_fields = ("user__email", "full_name", "national_id_plain", "national_id_hash")


@admin.register(Employer)
class EmployerAdmin(admin.ModelAdmin):
    """Moderate Employers; filter by status."""
    list_display = ("id", "user", "company_name", "cr_number_plain", "status")
    list_filter = ("status",)
    search_fields = ("user__email", "company_name", "cr_number_plain", "verifier_id_hash")


@admin.register(Institution)
class InstitutionAdmin(admin.ModelAdmin):
    """Moderate Institutions; filter by status."""
    list_display = ("id", "user", "institution_name", "status")
    list_filter = ("status",)
    search_fields = ("user__email", "institution_name")
