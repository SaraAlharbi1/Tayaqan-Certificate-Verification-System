# backend/api/access/test/test_unit.py
"""Unit tests for Access app models."""

from django.test import TestCase
from django.utils import timezone
from datetime import timedelta

from api.access.models import AccessRequest, AccessShare
from api.accounts.models import User, Employer, Applicant, Institution
from api.certificates.models import Certificate


class AccessShareModelTest(TestCase):
    """Unit tests for AccessShare model methods."""

    def setUp(self):
        """Set up test data."""
        # Create users
        self.employer_user = User.objects.create_user(
            email="employer@test.com",
            password="testpass123",
            role="EMPLOYER"
        )
        self.applicant_user = User.objects.create_user(
            email="applicant@test.com",
            password="testpass123",
            role="APPLICANT"
        )
        
        # Create employer
        self.employer = Employer.objects.create(
            user=self.employer_user,
            full_name="Test Employer",
            company_name="Test Company",
            official_email="employer@testcompany.com",
            status="APPROVED"
        )
        
        # Create applicant
        self.applicant = Applicant.objects.create(
            user=self.applicant_user,
            full_name="Test Applicant",
            national_id_plain="1234567890"
        )
        
        # Create institution
        self.institution_user = User.objects.create_user(
            email="institution@test.com",
            password="testpass123",
            role="INSTITUTION"
        )
        self.institution = Institution.objects.create(
            user=self.institution_user,
            institution_name="Test University",
            status="APPROVED"
        )
        
        # Create certificate
        self.certificate = Certificate.objects.create(
            applicant=self.applicant,
            institution=self.institution,
            file_hash="0xabcd1234",
            contract_address="0x1234567890abcdef",
            issued_on=timezone.now().date(),
            display_label="Test Certificate"
        )
        
        # Create access request
        self.access_request = AccessRequest.objects.create(
            employer=self.employer,
            applicant=self.applicant,
            status=AccessRequest.Status.APPROVED
        )

    def test_is_expired_with_no_expiry(self):
        """Test that share with no expiry date is not expired."""
        share = AccessShare.objects.create(
            request=self.access_request,
            certificate=self.certificate,
            expiry_date=None,
            blockchain_synced=True
        )
        
        self.assertFalse(share.is_expired())

    def test_is_expired_with_future_expiry(self):
        """Test that share with future expiry date is not expired."""
        future_date = timezone.now() + timedelta(days=30)
        share = AccessShare.objects.create(
            request=self.access_request,
            certificate=self.certificate,
            expiry_date=future_date,
            blockchain_synced=True
        )
        
        self.assertFalse(share.is_expired())

    def test_is_expired_with_past_expiry(self):
        """Test that share with past expiry date is expired."""
        past_date = timezone.now() - timedelta(days=1)
        share = AccessShare.objects.create(
            request=self.access_request,
            certificate=self.certificate,
            expiry_date=past_date,
            blockchain_synced=True
        )
        
        self.assertTrue(share.is_expired())

    def test_is_active_when_synced_not_revoked_not_expired(self):
        """Test that share is active when synced, not revoked, and not expired."""
        share = AccessShare.objects.create(
            request=self.access_request,
            certificate=self.certificate,
            expiry_date=timezone.now() + timedelta(days=30),
            blockchain_synced=True,
            revoked_at=None
        )
        
        self.assertTrue(share.is_active())

    def test_is_not_active_when_not_synced(self):
        """Test that share is not active when not synced to blockchain."""
        share = AccessShare.objects.create(
            request=self.access_request,
            certificate=self.certificate,
            blockchain_synced=False
        )
        
        self.assertFalse(share.is_active())

    def test_is_not_active_when_revoked(self):
        """Test that share is not active when revoked."""
        share = AccessShare.objects.create(
            request=self.access_request,
            certificate=self.certificate,
            blockchain_synced=True,
            revoked_at=timezone.now()
        )
        
        self.assertFalse(share.is_active())

    def test_is_not_active_when_expired(self):
        """Test that share is not active when expired."""
        share = AccessShare.objects.create(
            request=self.access_request,
            certificate=self.certificate,
            blockchain_synced=True,
            expiry_date=timezone.now() - timedelta(days=1)
        )
        
        self.assertFalse(share.is_active())


class AccessRequestModelTest(TestCase):
    """Unit tests for AccessRequest model methods."""

    def setUp(self):
        """Set up test data."""
        self.employer_user = User.objects.create_user(
            email="employer@test.com",
            password="testpass123",
            role="EMPLOYER"
        )
        self.applicant_user = User.objects.create_user(
            email="applicant@test.com",
            password="testpass123",
            role="APPLICANT"
        )
        
        self.employer = Employer.objects.create(
            user=self.employer_user,
            full_name="Test Employer",
            company_name="Test Company",
            official_email="employer@testcompany.com",
            status="APPROVED"
        )
        
        self.applicant = Applicant.objects.create(
            user=self.applicant_user,
            full_name="Test Applicant",
            national_id_plain="1234567890"
        )

    def test_approve_sets_status_and_timestamp(self):
        """Test that approve() sets status to APPROVED and sets decided_at."""
        request = AccessRequest.objects.create(
            employer=self.employer,
            applicant=self.applicant,
            status=AccessRequest.Status.PENDING
        )
        
        self.assertIsNone(request.decided_at)
        
        request.approve()
        
        self.assertEqual(request.status, AccessRequest.Status.APPROVED)
        self.assertIsNotNone(request.decided_at)

    def test_reject_sets_status_and_timestamp(self):
        """Test that reject() sets status to REJECTED and sets decided_at."""
        request = AccessRequest.objects.create(
            employer=self.employer,
            applicant=self.applicant,
            status=AccessRequest.Status.PENDING
        )
        
        self.assertIsNone(request.decided_at)
        
        request.reject()
        
        self.assertEqual(request.status, AccessRequest.Status.REJECTED)
        self.assertIsNotNone(request.decided_at)

    def test_unique_pending_constraint(self):
        """Test that only one pending request can exist per employer-applicant pair."""
        AccessRequest.objects.create(
            employer=self.employer,
            applicant=self.applicant,
            status=AccessRequest.Status.PENDING
        )
        
        # Try to create another pending request - should fail
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            AccessRequest.objects.create(
                employer=self.employer,
                applicant=self.applicant,
                status=AccessRequest.Status.PENDING
            )

    def test_multiple_decided_requests_allowed(self):
        """Test that multiple decided requests can exist per employer-applicant pair."""
        # Create approved request
        AccessRequest.objects.create(
            employer=self.employer,
            applicant=self.applicant,
            status=AccessRequest.Status.APPROVED,
            decided_at=timezone.now()
        )
        
        # Create rejected request - should succeed
        request2 = AccessRequest.objects.create(
            employer=self.employer,
            applicant=self.applicant,
            status=AccessRequest.Status.REJECTED,
            decided_at=timezone.now()
        )
        
        self.assertIsNotNone(request2.id)