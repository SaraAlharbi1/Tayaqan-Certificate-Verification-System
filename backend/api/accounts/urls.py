# api/accounts/urls.py
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AuthViewSet,
    SignupViewSet,
    AdminAccountsViewSet,
    PasswordViewSet,
    verify_applicant,   # <-- ADD THIS IMPORT
)

router = DefaultRouter()
router.register(r"auth", AuthViewSet, basename="auth")
router.register(r"signup", SignupViewSet, basename="signup")
router.register(r"admin/accounts", AdminAccountsViewSet, basename="admin-accounts")
router.register(r"password", PasswordViewSet, basename="password")

urlpatterns = [
    path("", include(router.urls)),
    path(
        "applicants/verify/<str:national_id>/",
        verify_applicant,
        name="verify-applicant"
    ),
]
