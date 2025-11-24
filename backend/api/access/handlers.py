# backend/api/access/handlers.py
"""Email handlers for access request events."""

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from .events import register


def _handle_access_request_created(access_request):
    """
    Send email to applicant when employer creates a new request.
    Template: backend/api/access/templates/AccessRequestCreated.html
    """
    applicant = access_request.applicant
    employer = access_request.employer
    user = applicant.user

    recipient = user.email
    if not recipient:
        return  # nothing to send

    ctx = {
        "applicant_name": applicant.full_name,
        "employer_name": employer.company_name,
        "employer_email": employer.official_email,
        "request_date": access_request.created_at,
        "frontend_url": getattr(settings, "FRONTEND_URL", "http://localhost:5173"),
    }

    subject = f"Access Request from {employer.company_name} - Tayaqan"
    html_body = render_to_string("AccessRequestCreated.html", ctx)
    text_body = (
        f"Dear {ctx['applicant_name']},\n\n"
        f"{ctx['employer_name']} has requested access to your certificates.\n\n"
        f"Company: {ctx['employer_name']}\n"
        f"Email: {ctx['employer_email']}\n"
        f"Request Date: {ctx['request_date'].strftime('%Y-%m-%d %H:%M')}\n\n"
        f"Please log in to Tayaqan to review and approve or reject this request.\n"
        f"Login: {ctx['frontend_url']}/applicant/requests\n\n"
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


def _handle_access_request_approved(access_request):
    """
    Send email to employer when applicant approves the request.
    Template: backend/api/access/templates/AccessRequestApproved.html
    """
    applicant = access_request.applicant
    employer = access_request.employer

    recipient = employer.official_email
    if not recipient:
        return  # nothing to send

    # Count blockchain-synced shares
    shared_count = access_request.shares.filter(blockchain_synced=True).count()

    ctx = {
        "employer_name": employer.company_name,
        "applicant_name": applicant.full_name,
        "applicant_id": applicant.national_id_plain,
        "shared_count": shared_count,
        "approved_date": access_request.decided_at,
        "request_id": access_request.id,
        "frontend_url": getattr(settings, "FRONTEND_URL", "http://localhost:5173"),
    }

    subject = f"Access Approved by {applicant.full_name} - Tayaqan"
    html_body = render_to_string("AccessRequestApproved.html", ctx)
    text_body = (
        f"Dear {ctx['employer_name']},\n\n"
        f"{ctx['applicant_name']} has approved your access request!\n\n"
        f"Applicant: {ctx['applicant_name']}\n"
        f"National ID: {ctx['applicant_id']}\n"
        f"Certificates Shared: {ctx['shared_count']}\n"
        f"Approved Date: {ctx['approved_date'].strftime('%Y-%m-%d %H:%M')}\n\n"
        f"You can now view the shared certificates:\n"
        f"{ctx['frontend_url']}/employer/access/{ctx['request_id']}/certificates\n\n"
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


def _handle_access_request_rejected(access_request):
    """
    Send email to employer when applicant rejects the request.
    Template: backend/api/access/templates/AccessRequestRejected.html
    """
    applicant = access_request.applicant
    employer = access_request.employer

    recipient = employer.official_email
    if not recipient:
        return  # nothing to send

    ctx = {
        "employer_name": employer.company_name,
        "applicant_name": applicant.full_name,
        "applicant_id": applicant.national_id_plain,
        "rejected_date": access_request.decided_at,
    }

    subject = f"Access Request Declined - {applicant.full_name} - Tayaqan"
    html_body = render_to_string("AccessRequestRejected.html", ctx)
    text_body = (
        f"Dear {ctx['employer_name']},\n\n"
        f"{ctx['applicant_name']} has declined your access request.\n\n"
        f"Applicant: {ctx['applicant_name']}\n"
        f"National ID: {ctx['applicant_id']}\n"
        f"Rejected Date: {ctx['rejected_date'].strftime('%Y-%m-%d %H:%M')}\n\n"
        "You may contact the applicant directly if you have questions.\n\n"
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


# Wire events → handlers
register("access_request_created", _handle_access_request_created)
register("access_request_approved", _handle_access_request_approved)
register("access_request_rejected", _handle_access_request_rejected)