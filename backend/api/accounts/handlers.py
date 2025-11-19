# api/accounts/handlers.py

from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags


def _send_status_email(*, to_email: str, name: str, role_label: str, status: str):
    """
    Render Registration_update.html and send HTML + plain text email.
    """
    context = {
        "name": name,
        "role_label": role_label,
        "status": status,
    }

    html = render_to_string("Registration_update.html", context)
    text = strip_tags(html)

    email = EmailMultiAlternatives(
        subject=f"Tayaqan registration status: {status}",
        body=text,
        to=[to_email],
    )
    email.attach_alternative(html, "text/html")
    email.send()


def send_employer_approved_email(employer):
    """Observer for employer_approved event."""
    _send_status_email(
        to_email=employer.official_email,
        name=employer.full_name,
        role_label="Employer",
        status="APPROVED",
    )


def send_institution_approved_email(institution):
    """Observer for institution_approved event."""
    _send_status_email(
        to_email=institution.official_email,
        name=institution.institution_name,
        role_label="Institution",
        status="APPROVED",
    )
