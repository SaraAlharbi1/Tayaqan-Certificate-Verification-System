# backend/api/certificates/urls.py
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import InstitutionCertificateViewSet, MyCertificateViewSet

router = DefaultRouter()
router.register(r"certificates", InstitutionCertificateViewSet, basename="institution-certificates")
router.register(r"my/certificates", MyCertificateViewSet, basename="my-certificates")

urlpatterns = [
    # Institution routes
    # GET  /api/certificates/              -> list
    # GET  /api/certificates/{id}/         -> retrieve
    # POST /api/certificates/issue/        -> issue
    # GET  /api/certificates/{id}/file/    -> download decrypted PDF
    # POST /api/certificates/{id}/revoke/  -> revoke certificate

    # Applicant routes
    # GET  /api/my/certificates/           -> list current applicant’s certificates
    # GET  /api/my/certificates/{id}/      -> detail
    # GET  /api/my/certificates/{id}/file/ -> decrypted file download

    path("", include(router.urls)),
]
