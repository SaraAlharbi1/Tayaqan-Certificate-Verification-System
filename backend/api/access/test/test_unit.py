# backend/api/access/tests.py
"""
Unit Tests for Access App
2 Tests per Main Function
"""

from datetime import timedelta
from django.test import TestCase
from django.utils import timezone

from api.accounts.models import User, Applicant, Employer, Institution
from api.certificates.models import Certificate
from api.access.models import AccessRequest, AccessShare


class AccessTestSetup(TestCase):
    """Test data setup."""
    
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


# ============================================================
# TEST 1: CREATE ACCESS REQUEST (2 tests)
# ============================================================

class CreateAccessRequestTest(AccessTestSetup):
    
    def test_create_request_success(self):
        
        request = AccessRequest.objects.create(
            employer=self.employer,
            applicant=self.applicant
        )
        
        self.assertEqual(request.status, "PENDING")
        self.assertIsNotNone(request.created_at)
    
    def test_create_request_duplicate_fails(self):
        
        AccessRequest.objects.create(
            employer=self.employer,
            applicant=self.applicant,
            status="PENDING"
        )
        
        with self.assertRaises(Exception):
            AccessRequest.objects.create(
                employer=self.employer,
                applicant=self.applicant,
                status="PENDING"
            )


# ============================================================
# TEST 2: APPROVE ACCESS REQUEST (2 tests)
# ============================================================

class ApproveAccessRequestTest(AccessTestSetup):
    
    def test_approve_success(self):
        """Success: Status changes to APPROVED"""
        request = AccessRequest.objects.create(
            employer=self.employer,
            applicant=self.applicant
        )
        
        request.approve()
        request.save()
        
        self.assertEqual(request.status, "APPROVED")
        self.assertIsNotNone(request.decided_at)
    
    def test_approve_creates_active_share(self):
        """ Success: Share is active after approval"""
        request = AccessRequest.objects.create(
            employer=self.employer,
            applicant=self.applicant
        )
        request.approve()
        request.save()
        
        share = AccessShare.objects.create(
            request=request,
            certificate=self.certificate,
            blockchain_synced=True,
            expiry_date=timezone.now() + timedelta(days=365)
        )
        
        self.assertTrue(share.is_active())


# ============================================================
# TEST 3: REJECT ACCESS REQUEST (2 tests)
# ============================================================

class RejectAccessRequestTest(AccessTestSetup):
    
    def test_reject_success(self):
        """ Success: Status changes to REJECTED"""
        request = AccessRequest.objects.create(
            employer=self.employer,
            applicant=self.applicant
        )
        
        request.reject()
        request.save()
        
        self.assertEqual(request.status, "REJECTED")
        self.assertIsNotNone(request.decided_at)
    
    def test_reject_no_shares(self):
        """Success: No shares created after rejection"""
        request = AccessRequest.objects.create(
            employer=self.employer,
            applicant=self.applicant
        )
        request.reject()
        request.save()
        
        shares = AccessShare.objects.filter(request=request)
        
        self.assertEqual(shares.count(), 0)


# ============================================================
# TEST 4: VIEW SHARED CERTIFICATES (2 tests)
# ============================================================

class ViewSharedCertificatesTest(AccessTestSetup):
    
    def test_view_active_shares(self):
        """ Success: Employer sees active shares"""
        request = AccessRequest.objects.create(
            employer=self.employer,
            applicant=self.applicant,
            status="APPROVED"
        )
        AccessShare.objects.create(
            request=request,
            certificate=self.certificate,
            blockchain_synced=True
        )
        
        shares = AccessShare.objects.filter(
            request__employer=self.employer,
            blockchain_synced=True
        )
        
        self.assertEqual(shares.count(), 1)
    
    def test_expired_share_inactive(self):
        """Fail: Expired share is not active"""
        request = AccessRequest.objects.create(
            employer=self.employer,
            applicant=self.applicant,
            status="APPROVED"
        )
        share = AccessShare.objects.create(
            request=request,
            certificate=self.certificate,
            blockchain_synced=True,
            expiry_date=timezone.now() - timedelta(days=1) 
        )
        
        self.assertFalse(share.is_active())