"""
Reusable input validators.

Why a separate module?
----------------------
Keeps serializers simple and centralizes patterns/rules so changes are easy.
"""
import re

EMAIL_RE = re.compile(r"^[^@]+@[^@]+\.[^@]+$")
NATIONAL_ID_RE = re.compile(r"^\d{10}$")        # exact 10 ASCII digits
PHONE_RE = re.compile(r"^\+?\d{8,15}$")         # +optional, 8–15 digits


def is_email(s: str) -> bool:
    """Return True if 's' looks like an email address."""
    return bool(EMAIL_RE.match(s or ""))


def is_national_id_10_digits(s: str) -> bool:
    """Return True if 's' is exactly 10 ASCII digits."""
    return bool(NATIONAL_ID_RE.match(s or ""))


def validate_phone(s: str) -> bool:
    """Return True if 's' looks like a phone number (+optional, 8–15 digits)."""
    return bool(PHONE_RE.match(s or ""))


def strong_password(s: str) -> bool:
    """
    Very basic strength rule:
    - length >= 8
    - contains at least one letter and one digit
    """
    if not s or len(s) < 8:
        return False
    has_letter = any(c.isalpha() for c in s)
    has_digit = any(c.isdigit() for c in s)
    return has_letter and has_digit
