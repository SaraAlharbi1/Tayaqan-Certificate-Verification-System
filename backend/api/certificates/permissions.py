from rest_framework.permissions import BasePermission

from api.accounts.models import User


class IsInstitutionUser(BasePermission):
    """
    Only logged-in institution users (with Institution profile).
    """

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return (
            getattr(user, "role", None) == User.Roles.INSTITUTION
            and hasattr(user, "institution")
            and user.institution is not None
        )


class IsApplicantUser(BasePermission):
    """
    Only logged-in applicants (with Applicant profile).
    """

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return (
            getattr(user, "role", None) == User.Roles.APPLICANT
            and hasattr(user, "applicant")
            and user.applicant is not None
        )
