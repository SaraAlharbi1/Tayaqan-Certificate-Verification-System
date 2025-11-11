# backend/api/access/urls.py
"""Routes for access app."""
from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import EmployerAccessRequestViewSet, ApplicantAccessRequestViewSet, EmployerCertificateViewSet

router = DefaultRouter()
router.register(r"employer/requests", EmployerAccessRequestViewSet, basename="employer-requests")
router.register(r"my/requests", ApplicantAccessRequestViewSet, basename="my-requests")
router.register(r"employer/certificates", EmployerCertificateViewSet, basename="employer-certificates")

urlpatterns = [
    path("", include(router.urls)),
]
