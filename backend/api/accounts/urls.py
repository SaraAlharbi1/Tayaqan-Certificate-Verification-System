"""
Routes for Accounts.

Mounted under /api/ from core/urls.py
"""
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    LoginView,
    MeView,
    ApplicantSignupView,
    EmployerSignupView,
    InstitutionSignupView,
    AdminPendingList,
    AdminUpdateStatus,
   TokenRefreshView 
)

urlpatterns = [
    # Auth
    path("auth/login",   LoginView.as_view(),       name="auth-login"),
    path("auth/refresh", TokenRefreshView.as_view(), name="auth-refresh"),

    # Current user
    path("me", MeView.as_view(), name="me"),

    # Signups
    path("auth/signup/applicant",   ApplicantSignupView.as_view(),   name="signup-applicant"),
    path("auth/signup/employer",    EmployerSignupView.as_view(),    name="signup-employer"),
    path("auth/signup/institution", InstitutionSignupView.as_view(), name="signup-institution"),

    # Admin moderation
    path("admin/accounts/pending",                AdminPendingList.as_view(),  name="admin-pending"),
    path("admin/accounts/<int:user_id>/status",   AdminUpdateStatus.as_view(), name="admin-update-status"),
]
