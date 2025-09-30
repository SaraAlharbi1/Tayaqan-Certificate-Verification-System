"""
Custom DRF permissions for Accounts.

- HasRole(role):
    Gate an endpoint to a specific role (Applicant/Employer/Institution/Admin).
- IsEmployerApproved:
    Employers must be APPROVED to access sensitive certificate data.
    (They can still log in and create requests while PENDING per your policy.)
"""
from rest_framework.permissions import BasePermission
from .models import User, Employer


class HasRole(BasePermission):
    """Simple role check permission."""

    def __init__(self, role):
        self.role = role

    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated and request.user.role == self.role)


class IsEmployerApproved(BasePermission):
    """
    Allow if:
    - user is NOT an employer (check doesn't apply), OR
    - user is an employer with status = APPROVED.
    """
    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.role != User.Roles.EMPLOYER:
            return True
        emp = getattr(user, "employer", None)
        return bool(emp and emp.status == Employer.Status.APPROVED)
