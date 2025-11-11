# backend/api/access/models.py

from django.db import models
from django.db.models import Q


class AccessRequest(models.Model):
    """Access request from employer to applicant"""
    
    class Status(models.TextChoices):
        PENDING = "PENDING"
        APPROVED = "APPROVED"
        DECLINED = "DECLINED"

    employer = models.ForeignKey(
        "accounts.Employer",
        on_delete=models.CASCADE,
        related_name="access_requests"
    )
    applicant = models.ForeignKey(
        "accounts.Applicant",
        on_delete=models.CASCADE,
        related_name="access_requests"
    )
    note = models.CharField(max_length=280, blank=True)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["employer", "applicant", "status"],
                condition=Q(status="PENDING"),
                name="uniq_pending_request_per_pair",
            )
        ]

    def __str__(self):
        return f"AccessRequest<{self.id}> {self.employer_id}->{self.applicant_id} [{self.status}]"


class AccessShare(models.Model):
    """Certificates shared by applicant with employer"""
    
    request = models.ForeignKey(
        AccessRequest,
        on_delete=models.CASCADE,
        related_name="shares"
    )
    certificate = models.ForeignKey(
        "certificates.Certificate",
        on_delete=models.CASCADE,
        related_name="access_shares"
    )
    approved_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("request", "certificate")

    def __str__(self):
        return f"AccessShare<req={self.request_id}, cert={self.certificate_id}>"