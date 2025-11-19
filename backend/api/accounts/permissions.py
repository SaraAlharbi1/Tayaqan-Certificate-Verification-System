"""
Custom DRF permissions for the Accounts domain.

- HasRole(role): restricts an endpoint to a specific user role.
- IsEmployerApproved: only approved employers may access protected endpoints.
- IsInstitutionApproved: only approved institutions may access protected endpoints.
"""

from rest_framework.permissions import BasePermission
from .models import User, Employer, Institution


class HasRole(BasePermission):
    """Allow access only to users with the specified role."""

    def __init__(self, role):
        self.role = role

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == self.role)


class IsEmployerApproved(BasePermission):
    """Allow only approved employers to access protected resources."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        # Applies only to employers
        if user.role != User.Roles.EMPLOYER:
            return True

        employer = getattr(user, "employer", None)
        return bool(employer and employer.status == Employer.Status.APPROVED)


class IsInstitutionApproved(BasePermission):
    """Allow only approved institutions to access protected resources."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        # Applies only to institutions
        if user.role != User.Roles.INSTITUTION:
            return True

        institution = getattr(user, "institution", None)
        return bool(institution and institution.status == Institution.Status.APPROVED)
