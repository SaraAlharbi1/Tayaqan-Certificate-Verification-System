# backend/api/access/urls.py

from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import (
    EmployerAccessRequestViewSet,
    ApplicantAccessRequestViewSet,
    EmployerCertificateViewSet
)

router = DefaultRouter()
router.register(r"employer/requests", EmployerAccessRequestViewSet, basename="employer-requests")
router.register(r"my/requests", ApplicantAccessRequestViewSet, basename="applicant-requests")
router.register(r"employer/certificates", EmployerCertificateViewSet, basename="employer-certificates")

urlpatterns = [path("", include(router.urls))]