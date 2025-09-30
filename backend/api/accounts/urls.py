from django.urls import path
from .views import (
    LoginView, MeView,
    ApplicantSignupView, EmployerSignupView, InstitutionSignupView,
    AdminPendingList, AdminUpdateStatus, TokenRefreshView,
    PasswordResetRequestView, PasswordResetConfirmView,  # <-- add
)

urlpatterns = [
    # Auth
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("me/", MeView.as_view(), name="me"),

    # Signups
    path("auth/signup/applicant/", ApplicantSignupView.as_view(), name="signup-applicant"),
    path("auth/signup/employer/", EmployerSignupView.as_view(), name="signup-employer"),
    path("auth/signup/institution/", InstitutionSignupView.as_view(), name="signup-institution"),

    # Admin moderation
    path("admin/accounts/pending/", AdminPendingList.as_view(), name="admin-pending-list"),
    path("admin/accounts/<int:user_id>/status/", AdminUpdateStatus.as_view(), name="admin-update-status"),

    # Password reset
    path("auth/password-reset/", PasswordResetRequestView.as_view(), name="password-reset"),
    path("auth/password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
]
