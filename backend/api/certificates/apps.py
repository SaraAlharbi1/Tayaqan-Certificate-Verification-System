from django.apps import AppConfig


class CertificatesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "api.certificates"

    def ready(self):
        # Import handlers so observer registration runs
        from . import handlers 
