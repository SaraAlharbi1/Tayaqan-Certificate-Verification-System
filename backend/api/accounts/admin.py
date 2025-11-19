"""Django admin interface for Accounts models."""

from django import forms
from django.db import models
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.utils.html import format_html

from .models import User, Applicant, Employer, Institution
from .events import employer_approved, institution_approved


def _proof_link(filefield):
    """Generate download link for proof documents."""
    if filefield and getattr(filefield, "url", None):
        return format_html('<a href="{}" target="_blank">Download PDF</a>', filefield.url)
    return "—"


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    """Admin for User model."""
    
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


@admin.register(Applicant)
class ApplicantAdmin(admin.ModelAdmin):
    """Admin for Applicant model."""
    
    list_display = ("id", "full_name", "national_id_plain", "phone", "wallet_address")
    search_fields = ("user__email", "full_name", "national_id_plain")
    readonly_fields = ("national_id_hash",)


@admin.register(Employer)
class EmployerAdmin(admin.ModelAdmin):
    """Admin for Employer model with approval workflow."""
    
    list_display = (
        "id",
        "company_name",
        "full_name",
        "official_email",
        "phone",
        "status",
        "proof_link",
    )
    list_display_links = ("id", "company_name")
    list_editable = ("status",)
    list_filter = ("status",)
    search_fields = ("user__email", "full_name", "company_name", "official_email")
    readonly_fields = ("proof_link",)

    @admin.display(description="Proof")
    def proof_link(self, obj):
        return _proof_link(obj.proof_doc)

    def save_model(self, request, obj, form, change):
        """Trigger approval event on status change."""
        old_status = None
        if obj.pk:
            old_status = Employer.objects.get(pk=obj.pk).status
        
        super().save_model(request, obj, form, change)
        
        if change and obj.status != old_status and obj.status == Employer.Status.APPROVED:
            employer_approved(obj)


@admin.register(Institution)
class InstitutionAdmin(admin.ModelAdmin):
    """
    Admin for Institution model with blockchain auto-deployment.
    On approval: deploys CertificateRegistry + registers in InstitutionRegistry.
    """
    
    list_display = (
        "id",
        "institution_name",
        "institution_id",
        "status",  # ✅ Changed from status_badge to actual field
        "contract_status",
        "registry_status",
        "official_email",
    )
    list_display_links = ("id", "institution_name")
    list_editable = ("status",)  # ✅ Now this works because "status" is in list_display
    list_filter = ("status", "registered_in_registry")
    search_fields = ("institution_name", "official_email", "institution_id")

    readonly_fields = ("proof_link", "institution_id", "contract_address", "deployed_at", "registered_in_registry")

    fieldsets = (
        ("Institution Info", {
            "fields": ("institution_name", "official_email", "phone", "wallet_address", "proof_doc")
        }),
        ("Status", {
            "fields": ("status",)
        }),
        ("Blockchain (Auto-filled)", {
            "fields": ("institution_id", "contract_address", "deployed_at", "registered_in_registry"),
            "classes": ("collapse",)
        }),
    )

    @admin.display(description="Proof")
    def proof_link(self, obj):
        return _proof_link(obj.proof_doc)
    
    @admin.display(description="Contract")
    def contract_status(self, obj):
        """Display contract address or pending status."""
        if obj.contract_address:
            return format_html(
                '✅ <small>{}</small>',
                obj.contract_address[:10] + '...'
            )
        return '⏳ Not deployed'
    
    @admin.display(description="Registry")
    def registry_status(self, obj):
        """Display registry registration status."""
        if obj.registered_in_registry:
            return format_html('<span style="color: green;">✅ Registered</span>')
        return format_html('<span style="color: orange;">⏳ Pending</span>')

    def save_model(self, request, obj, form, change):
        """Trigger blockchain deployment on approval."""
        old_status = None
        if obj.pk:
            old_status = Institution.objects.get(pk=obj.pk).status
        
        super().save_model(request, obj, form, change)
        
        # Trigger auto-deployment
        if change and obj.status != old_status and obj.status == Institution.Status.APPROVED:
            institution_approved(obj)
    
    actions = ['approve_selected', 'reject_selected']
    
    def approve_selected(self, request, queryset):
        """Bulk approve institutions with auto-deployment."""
        count = 0
        for inst in queryset.filter(status=Institution.Status.PENDING):
            inst.status = Institution.Status.APPROVED
            inst.save()
            institution_approved(inst)
            count += 1
        self.message_user(request, f'{count} institution(s) approved and deployed!')
    approve_selected.short_description = 'Approve and deploy selected'
    
    def reject_selected(self, request, queryset):
        """Bulk reject institutions."""
        updated = queryset.update(status=Institution.Status.REJECTED)
        self.message_user(request, f'{updated} institution(s) rejected.')
    reject_selected.short_description = 'Reject selected'