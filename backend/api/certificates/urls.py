# backend/api/certificates/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    InstitutionCertificateViewSet,
    MyCertificatesViewSet,
    EmployerCertificatesViewSet,
)

router = DefaultRouter()
router.register(r"institution/certificates", InstitutionCertificateViewSet, basename="institution-certificates")
router.register(r"my/certificates", MyCertificatesViewSet, basename="my-certificates")
router.register(r"employer/certificates", EmployerCertificatesViewSet, basename="employer-certificates")  # ← same style

urlpatterns = [path("", include(router.urls))]
