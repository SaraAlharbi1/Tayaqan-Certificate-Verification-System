from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

from .events import register


def _handle_certificate_issued(certificate):
    """
    Send email to the applicant notifying a new certificate was issued.
    Template path:
      backend/api/certificates/templates/NewCertificateIssued.html
    """

    applicant = certificate.applicant
    institution = certificate.institution
    user = applicant.user

    recipient = user.email
    if not recipient:
        return  # nothing to send

    ctx = {
        "name": applicant.full_name,
        "title": certificate.display_label,
        "institution_name": institution.institution_name,
        "issued_on": certificate.issued_on,
    }

    subject = "New certificate issued - Tayaqan"
    html_body = render_to_string("NewCertificateIssued.html", ctx)
    text_body = (
        f"Dear {ctx['name']},\n\n"
        f"A new certificate has been issued for you by {ctx['institution_name']}.\n"
        f"Title: {ctx['title']}\n"
        f"Issued on: {ctx['issued_on'] or '—'}\n\n"
        "You can log in to your Tayaqan account to view it.\n\n"
        "Tayaqan Team"
    )

    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None)

    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=from_email,
        to=[recipient],
    )
    msg.attach_alternative(html_body, "text/html")
    msg.send(fail_silently=True)


# Wire event → handler
register("certificate_issued", _handle_certificate_issued)
