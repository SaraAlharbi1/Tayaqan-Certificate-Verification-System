# backend/api/access/test/test_integration.py
"""Integration tests for Access app API endpoints."""

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status as http_status
from unittest.mock import patch, MagicMock

from api.access.models import AccessRequest, AccessShare
from api.accounts.models import User, Employer, Applicant, Institution
from api.certificates.models import Certificate


class AccessRequestApprovalIntegrationTest(TestCase):
    """Integration test for the complete approval workflow."""

    def setUp(self):
        """Set up test data and API client."""
        self.client = APIClient()
        
        # Create employer
        self.employer_user = User.objects.create_user(
            email="employer@test.com",
            password="testpass123",
            role="EMPLOYER"
        )
        self.employer = Employer.objects.create(
            user=self.employer_user,
            full_name="Test Employer",
            company_name="Test Company",
            official_email="employer@testcompany.com",
            status="APPROVED"
        )
        
        # Create applicant
        self.applicant_user = User.objects.create_user(
            email="applicant@test.com",
            password="testpass123",
            role="APPLICANT"
        )
        self.applicant = Applicant.objects.create(
            user=self.applicant_user,
            full_name="Test Applicant",
            national_id_plain="9876543210"
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
            status="APPROVED",
            contract_address="0x1234567890abcdef"
        )
        
        # Create certificates
        self.cert1 = Certificate.objects.create(
            applicant=self.applicant,
            institution=self.institution,
            file_hash="0xabcd1234",
            contract_address="0x1234567890abcdef",
            issued_on=timezone.now().date(),
            display_label="Bachelor Degree",
            file_cid="bafytest123"
        )
        self.cert2 = Certificate.objects.create(
            applicant=self.applicant,
            institution=self.institution,
            file_hash="0xefgh5678",
            contract_address="0x1234567890abcdef",
            issued_on=timezone.now().date(),
            display_label="Master Degree",
            file_cid="bafytest456"
        )
        
        # Create pending access request
        self.access_request = AccessRequest.objects.create(
            employer=self.employer,
            applicant=self.applicant,
            status=AccessRequest.Status.PENDING
        )

    @patch('api.access.views._get_employer_id_hash')
    @patch('api.access.views.create_blockchain_service')
    @patch('api.access.views.send_status_update_email')
    def test_complete_approval_workflow(self, mock_email, mock_blockchain, mock_hash):
        """
        Test the complete approval workflow:
        1. Applicant approves request with selected certificates
        2. AccessShares are created
        3. Blockchain sync is attempted
        4. Email notification is sent
        """
        # Mock employer ID hash
        mock_hash.return_value = "0xemployerhash123"
        
        # Mock blockchain service
        mock_service = MagicMock()
        mock_service.add_employer_access.return_value = {
            "success": True,
            "tx_hash": "0xtxhash123",
            "block_number": 12345
        }
        mock_blockchain.return_value = mock_service
        
        # Login as applicant
        self.client.force_authenticate(user=self.applicant_user)
        
        # Approve request with certificates
        url = f'/api/access/my/requests/{self.access_request.id}/approve/'
        data = {
            "certificate_ids": [self.cert1.id, self.cert2.id],
            "expiry_days": 365
        }
        
        response = self.client.post(url, data, format='json')
        
        # Assert response
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)
        self.assertEqual(response.data["shares_created"], 2)
        self.assertEqual(response.data["blockchain_synced"], 2)
        
        # Assert request was approved
        self.access_request.refresh_from_db()
        self.assertEqual(self.access_request.status, AccessRequest.Status.APPROVED)
        self.assertIsNotNone(self.access_request.decided_at)
        
        # Assert shares were created
        shares = AccessShare.objects.filter(request=self.access_request)
        self.assertEqual(shares.count(), 2)
        
        # Assert blockchain sync was called
        self.assertEqual(mock_service.add_employer_access.call_count, 2)
        
        # Assert all shares are synced
        for share in shares:
            self.assertTrue(share.blockchain_synced)
            self.assertEqual(share.blockchain_tx_hash, "0xtxhash123")
            self.assertIsNotNone(share.expiry_date)
        
        # Assert email was sent
        mock_email.assert_called_once()

    @patch('api.access.views._get_employer_id_hash')
    @patch('api.access.views.create_blockchain_service')
    def test_approval_with_blockchain_failure(self, mock_blockchain, mock_hash):
        """Test approval when blockchain sync fails."""
        # Mock employer ID hash
        mock_hash.return_value = "0xemployerhash123"
        
        # Mock blockchain service to fail
        mock_service = MagicMock()
        mock_service.add_employer_access.return_value = {
            "success": False,
            "error": "Transaction reverted"
        }
        mock_blockchain.return_value = mock_service
        
        # Login as applicant
        self.client.force_authenticate(user=self.applicant_user)
        
        # Approve request
        url = f'/api/access/my/requests/{self.access_request.id}/approve/'
        data = {
            "certificate_ids": [self.cert1.id],
            "expiry_days": 0
        }
        
        response = self.client.post(url, data, format='json')
        
        # Assert response shows partial success
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)
        self.assertEqual(response.data["shares_created"], 1)
        self.assertEqual(response.data["blockchain_synced"], 0)
        self.assertIn("blockchain_errors", response.data)
        
        # Assert share was created but not synced
        share = AccessShare.objects.get(
            request=self.access_request,
            certificate=self.cert1
        )
        self.assertFalse(share.blockchain_synced)
        self.assertIsNone(share.blockchain_tx_hash)
        self.assertIsNone(share.expiry_date)

        
def test_employer_can_view_approved_certificates(self):
    """Test that employer can view certificates after approval."""
    # Approve and create share
    self.access_request.approve()
    self.access_request.save()
    
    share = AccessShare.objects.create(
        request=self.access_request,
        certificate=self.cert1,
        blockchain_synced=True,
        expiry_date=timezone.now() + timezone.timedelta(days=365)
    )
    
    # Login as employer
    self.client.force_authenticate(user=self.employer_user)
    
    # List shared certificates
    url = '/api/access/employer/certificates/'
    response = self.client.get(url)
    
    self.assertEqual(response.status_code, http_status.HTTP_200_OK)
    self.assertIn("results", response.data)
    self.assertEqual(response.data["count"], 1)
    self.assertEqual(len(response.data["results"]), 1)
    
    cert_data = response.data["results"][0]
    self.assertEqual(cert_data["title"], "Bachelor Degree")
    self.assertTrue(cert_data["is_active"])
    self.assertFalse(cert_data["is_expired"])

    def test_employer_cannot_view_rejected_request_certificates(self):
        """Test that employer cannot view certificates from rejected request."""
        # Reject request
        self.access_request.reject()
        self.access_request.save()
        
        # Login as employer
        self.client.force_authenticate(user=self.employer_user)
        
        # Try to view shared certificates
        url = f'/api/access/employer/requests/{self.access_request.id}/shared/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)
        self.assertEqual(response.data["certificates"], [])

    def test_applicant_cannot_approve_already_decided_request(self):
        """Test that applicant cannot approve already decided request."""
        # Approve request first
        self.access_request.approve()
        self.access_request.save()
        
        # Login as applicant
        self.client.force_authenticate(user=self.applicant_user)
        
        # Try to approve again
        url = f'/api/access/my/requests/{self.access_request.id}/approve/'
        data = {"certificate_ids": [self.cert1.id]}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, http_status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    @patch('api.access.views._get_employer_id_hash')
    @patch('api.access.views.create_blockchain_service')
    def test_revoke_access_workflow(self, mock_blockchain, mock_hash):
        """Test revoking employer access to certificates."""
        # Mock employer ID hash
        mock_hash.return_value = "0xemployerhash123"
        
        # Setup: approved request with share
        self.access_request.approve()
        self.access_request.save()
        
        share = AccessShare.objects.create(
            request=self.access_request,
            certificate=self.cert1,
            blockchain_synced=True,
            blockchain_tx_hash="0xtxhash123"
        )
        
        # Mock blockchain service
        mock_service = MagicMock()
        mock_service.remove_employer_access.return_value = {
            "success": True,
            "tx_hash": "0xrevokehash456"
        }
        mock_blockchain.return_value = mock_service
        
        # Login as applicant
        self.client.force_authenticate(user=self.applicant_user)
        
        # Revoke access
        url = f'/api/access/my/requests/{self.access_request.id}/revoke_access/'
        data = {"certificate_ids": [self.cert1.id]}
        
        response = self.client.post(url, data, format='json')
        
        # Assert response
        self.assertEqual(response.status_code, http_status.HTTP_200_OK)
        self.assertEqual(response.data["revoked_count"], 1)
        
        # Assert share was revoked
        share.refresh_from_db()
        self.assertIsNotNone(share.revoked_at)
        self.assertEqual(share.revoke_tx_hash, "0xrevokehash456")
        
        # Assert blockchain was called
        mock_service.remove_employer_access.assert_called_once()