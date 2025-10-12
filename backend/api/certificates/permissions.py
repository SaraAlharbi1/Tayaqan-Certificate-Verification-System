from rest_framework.permissions import BasePermission

class IsInstitutionUser(BasePermission):
    """
    Allows access only to users linked to an Institution.
    You already enforce one user per institution.
    """
    message = "User is not linked to an institution."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        # Expect Institution has OneToOne/ForeignKey from Institution to User as .user
        try:
            institution = user.institution  # if you have OneToOneField(Institution, user=OneToOne)
        except Exception:
            # If you modeled it as Institution.objects.get(user=user), fallback:
            try:
                from accounts.models import Institution
                institution = Institution.objects.get(user=user)
            except Exception:
                return False
        # Optionally require APPROVED status for reads as well, or relax:
        return True
