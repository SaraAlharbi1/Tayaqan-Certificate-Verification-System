"""
Accounts app registration.

Purpose
-------
Registers the Accounts Django app and assigns a short label ("accounts")
so AUTH_USER_MODEL can reference "accounts.User".

When Django starts, it uses this config to discover app metadata.
You can later use AppConfig.ready() for signals/bootstrap logic.
"""
from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "api.accounts"   # python import path for this app
    label = "accounts"      # short app label used by AUTH_USER_MODEL
