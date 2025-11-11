# backend/api/access/models.py
"""Access domain: request (employer→applicant) and shares (approved certs)."""
from django.db import models
from django.utils import timezone
from api.accounts.models import Employer, Applicant
from api.certificates.models import Certificate


class AccessRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    employer = models.ForeignKey(Employer, on_delete=models.CASCADE, related_name="access_requests")
    applicant = models.ForeignKey(Applicant, on_delete=models.CASCADE, related_name="incoming_requests")

    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["employer", "created_at"]),
            models.Index(fields=["applicant", "created_at"]),
        ]
        constraints = [
            # Only one *pending* request per employer↔applicant pair
            models.UniqueConstraint(
                fields=["employer", "applicant", "status"],
                condition=models.Q(status="PENDING"),
                name="uniq_pending_request_per_pair",
            )
        ]

    def approve(self):
        self.status = self.Status.APPROVED
        self.decided_at = timezone.now()

    def reject(self):
        self.status = self.Status.REJECTED
        self.decided_at = timezone.now()

    def __str__(self):
        return f"AccessRequest<{self.employer_id}->{self.applicant_id}:{self.status}>"


class AccessShare(models.Model):
    """Certificates granted to the employer via a request."""
    request = models.ForeignKey(AccessRequest, on_delete=models.CASCADE, related_name="shares")
    certificate = models.ForeignKey(Certificate, on_delete=models.CASCADE, related_name="access_shares")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("request", "certificate")]
        indexes = [models.Index(fields=["request"]), models.Index(fields=["certificate"])]

    def clean(self):
        # Ensure the certificate belongs to the same applicant of the request
        if self.request and self.certificate and self.request.applicant_id != self.certificate.applicant_id:
            from django.core.exceptions import ValidationError
            raise ValidationError("Certificate does not belong to this applicant.")

    def __str__(self):
        return f"AccessShare<req={self.request_id}, cert={self.certificate_id}>"
