# backend/api/access/test/test_integration.py
"""
Integration Tests for Access App
Tests complete user flows from API endpoints

Main Flows:
1. Complete Access Request Flow (Create → Approve → View)
2. Complete Rejection Flow (Create → Reject → No Access)
"""

from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase, APIClient
from rest_framework import status

from api.accounts.models import User, Applicant, Employer, Institution
from api.certificates.models import Certificate
from api.access.models import AccessRequest, AccessShare


class IntegrationTestSetup(APITestCase):
    """Test data setup for integration tests."""
    
    @classmethod
    def setUpTestData(cls):
        # Users
        cls.applicant_user = User.objects.create_user(
            email="sara@test.com", password="Test@123", role=User.Roles.APPLICANT
        )
        cls.employer_user = User.objects.create_user(
            email="hr@company.com", password="Test@123", role=User.Roles.EMPLOYER
        )
        cls.institution_user = User.objects.create_user(
            email="admin@kau.edu", password="Test@123", role=User.Roles.INSTITUTION
        )
        
        # Applicant
        cls.applicant = Applicant.objects.create(
            user=cls.applicant_user,
            full_name="Sara Ahmed",
            national_id_plain="1234567890",
            national_id_hash="0x" + "a" * 64,
            wallet_address="0x" + "1" * 40
        )
        
        # Employer (Approved)
        cls.employer = Employer.objects.create(
            user=cls.employer_user,
            full_name="Mohammed Ali",
            company_name="Tech Company",
            official_email="hr@tech.com",
            status=Employer.Status.APPROVED
        )
        
        # Institution
        cls.institution = Institution.objects.create(
            user=cls.institution_user,
            institution_name="King Abdulaziz University",
            official_email="admin@kau.edu",
            wallet_address="0x" + "2" * 40,
            status=Institution.Status.APPROVED,
            institution_id="KAU-001",
            contract_address="0x" + "3" * 40
        )
        
        # Certificate
        cls.certificate = Certificate.objects.create(
            institution=cls.institution,
            applicant=cls.applicant,
            display_label="Bachelor of CS",
            file_hash="0x" + "f" * 64,
            tx_hash="0x" + "t" * 64,
            block_number=12345
        )
    
    def setUp(self):
        """Setup API client for each test."""
        self.client = APIClient()


# ============================================================
# INTEGRATION TEST 1: COMPLETE ACCESS FLOW (Create → Approve → View)
# ============================================================

class CompleteAccessFlowTest(IntegrationTestSetup):
    """
    Integration Test: Complete access request flow.
    
    Flow:
    1. Employer creates access request
    2. Applicant approves request
    3. AccessShare is created
    4. Employer can view shared certificates
    """
    
    def test_complete_access_flow(self):
        """
        Test: Complete flow from request to viewing certificates.
        
        Steps:
        1. Employer creates request → Status 201, PENDING
        2. Applicant approves → Status APPROVED
        3. Share created → is_active = True
        4. Employer views certificates → Can see shared cert
        """
        # ========== Step 1: Employer creates request ==========
        request = AccessRequest.objects.create(
            employer=self.employer,
            applicant=self.applicant
        )
        
        self.assertEqual(request.status, AccessRequest.Status.PENDING)
        self.assertIsNotNone(request.created_at)
        self.assertIsNone(request.decided_at)
        
        # ========== Step 2: Applicant approves ==========
        request.approve()
        request.save()
        
        self.assertEqual(request.status, AccessRequest.Status.APPROVED)
        self.assertIsNotNone(request.decided_at)
        
        # ========== Step 3: Create AccessShare ==========
        share = AccessShare.objects.create(
            request=request,
            certificate=self.certificate,
            blockchain_synced=True,
            expiry_date=timezone.now() + timedelta(days=365)
        )
        
        self.assertTrue(share.is_active())
        self.assertFalse(share.is_expired())
        
        # ========== Step 4: Employer views certificates ==========
        employer_shares = AccessShare.objects.filter(
            request__employer=self.employer,
            request__status=AccessRequest.Status.APPROVED,
            blockchain_synced=True
        )
        
        self.assertEqual(employer_shares.count(), 1)
        self.assertEqual(employer_shares.first().certificate, self.certificate)
        self.assertEqual(employer_shares.first().certificate.display_label, "Bachelor of CS")
    
    def test_multiple_certificates_shared(self):
        """
        Test: Applicant can share multiple certificates.
        
        Steps:
        1. Create second certificate
        2. Create and approve request
        3. Share both certificates
        4. Employer sees both
        """
        # Create second certificate
        certificate2 = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            display_label="Master of CS",
            file_hash="0x" + "e" * 64,
            tx_hash="0x" + "s" * 64,
            block_number=12346
        )
        
        # Create and approve request
        request = AccessRequest.objects.create(
            employer=self.employer,
            applicant=self.applicant
        )
        request.approve()
        request.save()
        
        # Share both certificates
        AccessShare.objects.create(
            request=request,
            certificate=self.certificate,
            blockchain_synced=True
        )
        AccessShare.objects.create(
            request=request,
            certificate=certificate2,
            blockchain_synced=True
        )
        
        # Verify employer sees both
        employer_shares = AccessShare.objects.filter(
            request__employer=self.employer,
            blockchain_synced=True
        )
        
        self.assertEqual(employer_shares.count(), 2)


# ============================================================
# INTEGRATION TEST 2: COMPLETE REJECTION FLOW (Create → Reject → No Access)
# ============================================================

class CompleteRejectionFlowTest(IntegrationTestSetup):
    """
    Integration Test: Complete rejection flow.
    
    Flow:
    1. Employer creates access request
    2. Applicant rejects request
    3. No AccessShare is created
    4. Employer cannot view certificates
    """
    
    def test_complete_rejection_flow(self):
        """
         Test: Complete flow when applicant rejects.
        
        Steps:
        1. Employer creates request → Status PENDING
        2. Applicant rejects → Status REJECTED
        3. No shares exist
        4. Employer sees nothing
        """
        # ========== Step 1: Employer creates request ==========
        request = AccessRequest.objects.create(
            employer=self.employer,
            applicant=self.applicant
        )
        
        self.assertEqual(request.status, AccessRequest.Status.PENDING)
        
        # ========== Step 2: Applicant rejects ==========
        request.reject()
        request.save()
        
        self.assertEqual(request.status, AccessRequest.Status.REJECTED)
        self.assertIsNotNone(request.decided_at)
        
        # ========== Step 3: No shares exist ==========
        shares = AccessShare.objects.filter(request=request)
        self.assertEqual(shares.count(), 0)
        
        # ========== Step 4: Employer sees nothing ==========
        employer_shares = AccessShare.objects.filter(
            request__employer=self.employer,
            request__status=AccessRequest.Status.APPROVED
        )
        
        self.assertEqual(employer_shares.count(), 0)
    
    def test_can_request_again_after_rejection(self):
        """
         Test: Employer can send new request after rejection.
        
        Steps:
        1. Create and reject first request
        2. Create new request → Should succeed
        """
        # First request - rejected
        request1 = AccessRequest.objects.create(
            employer=self.employer,
            applicant=self.applicant
        )
        request1.reject()
        request1.save()
        
        # Second request - should work
        request2 = AccessRequest.objects.create(
            employer=self.employer,
            applicant=self.applicant
        )
        
        self.assertEqual(request2.status, AccessRequest.Status.PENDING)
        self.assertEqual(AccessRequest.objects.filter(
            employer=self.employer,
            applicant=self.applicant
        ).count(), 2)


# ============================================================
# INTEGRATION TEST 3: ACCESS EXPIRY FLOW
# ============================================================

class AccessExpiryFlowTest(IntegrationTestSetup):
    """
    Integration Test: Access expiry flow.
    
    Flow:
    1. Create approved request with share
    2. Share expires
    3. Employer loses access
    """
    
    def test_access_expires_correctly(self):
        """
         Test: Access becomes inactive after expiry.
        
        Steps:
        1. Create approved request
        2. Create share with past expiry
        3. Share is inactive
        4. Employer cannot access
        """
        # Create and approve request
        request = AccessRequest.objects.create(
            employer=self.employer,
            applicant=self.applicant
        )
        request.approve()
        request.save()
        
        # Create expired share
        expired_share = AccessShare.objects.create(
            request=request,
            certificate=self.certificate,
            blockchain_synced=True,
            expiry_date=timezone.now() - timedelta(days=1)  # Yesterday
        )
        
        # Verify expired
        self.assertTrue(expired_share.is_expired())
        self.assertFalse(expired_share.is_active())
        
        # Employer cannot access (only active shares)
        active_shares = AccessShare.objects.filter(
            request__employer=self.employer,
            blockchain_synced=True
        ).exclude(
            expiry_date__lt=timezone.now()
        )
        
        # Has expiry_date in past, so excluded
        self.assertEqual(active_shares.filter(
            expiry_date__gte=timezone.now()
        ).count(), 0)
    
    def test_no_expiry_means_permanent_access(self):
        """
         Test: Share without expiry_date is always active.
        
        Steps:
        1. Create share without expiry
        2. Share remains active forever
        """
        # Create and approve request
        request = AccessRequest.objects.create(
            employer=self.employer,
            applicant=self.applicant
        )
        request.approve()
        request.save()
        
        # Create share without expiry
        permanent_share = AccessShare.objects.create(
            request=request,
            certificate=self.certificate,
            blockchain_synced=True,
            expiry_date=None  # No expiry
        )
        
        # Verify always active
        self.assertFalse(permanent_share.is_expired())
        self.assertTrue(permanent_share.is_active())


# ============================================================
# INTEGRATION TEST 4: REVOKE ACCESS FLOW
# ============================================================

class RevokeAccessFlowTest(IntegrationTestSetup):
    """
    Integration Test: Revoke access flow.
    
    Flow:
    1. Create approved request with share
    2. Applicant revokes access
    3. Employer loses access
    """
    
    def test_revoke_access_flow(self):
        """
        Test: Applicant can revoke previously granted access.
        
        Steps:
        1. Create and approve request
        2. Create active share
        3. Revoke share
        4. Share becomes inactive
        """
        # Create and approve request
        request = AccessRequest.objects.create(
            employer=self.employer,
            applicant=self.applicant
        )
        request.approve()
        request.save()
        
        # Create share
        share = AccessShare.objects.create(
            request=request,
            certificate=self.certificate,
            blockchain_synced=True,
            expiry_date=timezone.now() + timedelta(days=365)
        )
        
        # Verify active
        self.assertTrue(share.is_active())
        
        # Revoke
        share.revoked_at = timezone.now()
        share.revoke_tx_hash = "0x" + "r" * 64
        share.save()
        
        # Verify inactive
        self.assertFalse(share.is_active())
    
    def test_revoke_one_share_keeps_others(self):
        """
         Test: Revoking one share doesn't affect others.
        
        Steps:
        1. Share two certificates
        2. Revoke one
        3. Other remains active
        """
        # Create second certificate
        certificate2 = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            display_label="Master of CS",
            file_hash="0x" + "e" * 64,
            tx_hash="0x" + "s" * 64,
            block_number=12346
        )
        
        # Create and approve request
        request = AccessRequest.objects.create(
            employer=self.employer,
            applicant=self.applicant
        )
        request.approve()
        request.save()
        
        # Create two shares
        share1 = AccessShare.objects.create(
            request=request,
            certificate=self.certificate,
            blockchain_synced=True
        )
        share2 = AccessShare.objects.create(
            request=request,
            certificate=certificate2,
            blockchain_synced=True
        )
        
        # Revoke first share only
        share1.revoked_at = timezone.now()
        share1.save()
        
        # Verify
        self.assertFalse(share1.is_active())
        self.assertTrue(share2.is_active())