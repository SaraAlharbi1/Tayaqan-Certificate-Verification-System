from django.apps import AppConfig

class AccessConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "api.access"   # <-- must be the full dotted path
    label = "access"      # app label used by `makemigrations access`
