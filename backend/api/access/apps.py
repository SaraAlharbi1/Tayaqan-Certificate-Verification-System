# backend/api/access/apps.py
from django.apps import AppConfig


class AccessConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "api.access"
    label = "access"
    
    def ready(self):
        """Import handlers when app is ready."""
        import api.access.handlers  # noqa