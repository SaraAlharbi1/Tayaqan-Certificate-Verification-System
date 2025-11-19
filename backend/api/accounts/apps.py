# api/accounts/apps.py

"""
Accounts app configuration.

- Registers the app under label "accounts".
- Wires domain events to observers in ready().
"""

from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "api.accounts"
    label = "accounts"

    def ready(self):
        # Local imports to avoid circular dependencies at import time.
        from .events import register
        from .handlers import (
            send_employer_approved_email,
            send_institution_approved_email,
        )

        # Observer pattern: register handlers for domain events.
        register("employer_approved", send_employer_approved_email)
        register("institution_approved", send_institution_approved_email)
