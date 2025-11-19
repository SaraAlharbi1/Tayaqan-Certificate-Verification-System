# api/certificates/urls.py

from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import InstitutionCertificateViewSet, MyCertificateViewSet

router = DefaultRouter()
router.register(r"institution", InstitutionCertificateViewSet, basename="institution-certificates")
router.register(r"my", MyCertificateViewSet, basename="my-certificates")

urlpatterns = [
    path("", include(router.urls)),
]
