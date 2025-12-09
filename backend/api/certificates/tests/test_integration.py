# backend/api/certificates/tests/test_integration.py
"""
================================================================================
TAYAQAN Certificate Verification System
Integration Tests (Django TestCase Style)
================================================================================

 Location: backend/api/certificates/tests/test_integration.py
 Run: python manage.py test api.certificates.tests.test_integration

================================================================================
"""

import uuid
from datetime import date
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from unittest.mock import patch, Mock

from api.accounts.models import Applicant, Employer, Institution
from api.certificates.models import Certificate

User = get_user_model()


# ============================================================================
#                        HELPER FUNCTIONS
# ============================================================================

def _hash_text(text: str) -> str:
    """Generate keccak256 hash of text."""
    from eth_hash.auto import keccak
    return "0x" + keccak(text.encode("utf-8")).hex()


def _unique_hash():
    """Generate a unique 66-char hash (0x + 64 hex)."""
    uid = uuid.uuid4().hex
    return "0x" + uid + uid  # 0x + 32 + 32 = 66 chars


# ============================================================================
#                     BASE TEST SETUP
# ============================================================================

class IntegrationTestSetup(TestCase):
    """Base setup for all integration tests."""
    
    @classmethod
    def setUpTestData(cls):
        """Set up data for the whole TestCase - runs once."""
        
        # ============== USERS ==============
        cls.institution_user = User.objects.create_user(
            email="institution@test.edu",
            password="testpassword123",
            role=User.Roles.INSTITUTION
        )
        
        cls.applicant_user = User.objects.create_user(
            email="applicant@test.com",
            password="testpassword123",
            role=User.Roles.APPLICANT
        )
        
        cls.employer_user = User.objects.create_user(
            email="employer@company.com",
            password="testpassword123",
            role=User.Roles.EMPLOYER
        )
        
        cls.second_applicant_user = User.objects.create_user(
            email="applicant2@test.com",
            password="testpassword123",
            role=User.Roles.APPLICANT
        )
        
        # ============== PROFILES ==============
        proof_doc = SimpleUploadedFile(
            "proof.pdf",
            b"%PDF-1.4 test content",
            content_type="application/pdf"
        )
        
        cls.institution = Institution.objects.create(
            user=cls.institution_user,
            institution_name="Test University",
            official_email="official@test.edu",
            phone="+966500000000",
            wallet_address="0x1234567890123456789012345678901234567890",
            proof_doc=proof_doc,
            status=Institution.Status.APPROVED,
            institution_id="TES-001",
            contract_address="0xContractAddress12345678901234567890ab",
        )
        
        national_id = "1234567890"
        cls.applicant = Applicant.objects.create(
            user=cls.applicant_user,
            full_name="John Doe",
            national_id_plain=national_id,
            national_id_hash=_hash_text(national_id),
            wallet_address="0x9876543210987654321098765432109876543210",
            phone="+966500000001",
        )
        
        national_id2 = "0987654321"
        cls.second_applicant = Applicant.objects.create(
            user=cls.second_applicant_user,
            full_name="Jane Smith",
            national_id_plain=national_id2,
            national_id_hash=_hash_text(national_id2),
            wallet_address="0x5555555555555555555555555555555555555555",
            phone="+966500000002",
        )
        
        employer_proof = SimpleUploadedFile(
            "employer_proof.pdf",
            b"%PDF-1.4 employer proof",
            content_type="application/pdf"
        )
        
        cls.employer = Employer.objects.create(
            user=cls.employer_user,
            full_name="HR Manager",
            company_name="Test Company",
            official_email="hr@company.com",
            phone="+966500000003",
            proof_doc=employer_proof,
            status=Employer.Status.APPROVED,
        )
    
    def setUp(self):
        """Set up API clients for each test."""
        self.client = APIClient()
        
        self.institution_client = APIClient()
        self.institution_client.force_authenticate(user=self.institution_user)
        
        self.applicant_client = APIClient()
        self.applicant_client.force_authenticate(user=self.applicant_user)
        
        self.employer_client = APIClient()
        self.employer_client.force_authenticate(user=self.employer_user)


# ============================================================================
#                   CERTIFICATE ISSUANCE TESTS
# ============================================================================

class CertificateIssuanceTest(IntegrationTestSetup):
    """Integration tests for certificate issuance."""
    
    @patch('api.certificates.views._upload_to_storacha')
    def test_prepare_certificate_success(self, mock_storacha):
        """ISSUE-001 [CRITICAL]: Prepare certificate for issuance."""
        mock_storacha.return_value = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"
        
        pdf_file = SimpleUploadedFile(
            "certificate.pdf",
            b"%PDF-1.4" + b"x" * (1024 * 100),
            content_type="application/pdf"
        )
        
        data = {
            'national_id': '1234567890',
            'full_name': 'John Doe',
            'title': 'Bachelor Degree',
            'certificate_type': 'Bachelor',
            'pdf_file': pdf_file
        }
        
        url = reverse('institution-certificates-prepare')
        response = self.institution_client.post(url, data, format='multipart')
        
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['success'])
        self.assertIn('blockchain_data', response.data)
        self.assertIn('file_hash', response.data['blockchain_data'])
        self.assertIn('applicant_id_hash', response.data['blockchain_data'])
        self.assertIn('cid', response.data['blockchain_data'])
    
    @patch('api.certificates.views._upload_to_storacha')
    def test_prepare_applicant_not_found(self, mock_storacha):
        """ISSUE-002: Prepare with non-existent national_id."""
        pdf_file = SimpleUploadedFile(
            "certificate.pdf",
            b"%PDF-1.4" + b"x" * 1024,
            content_type="application/pdf"
        )
        
        data = {
            'national_id': '9999999999',  # Non-existent
            'full_name': 'Unknown Person',
            'title': 'Test Certificate',
            'certificate_type': 'Bachelor',
            'pdf_file': pdf_file
        }
        
        url = reverse('institution-certificates-prepare')
        response = self.institution_client.post(url, data, format='multipart')
        
        self.assertEqual(response.status_code, 404)
    
    @patch('api.certificates.views._upload_to_storacha')
    def test_prepare_name_mismatch(self, mock_storacha):
        """ISSUE-003: Prepare with wrong name for national_id."""
        pdf_file = SimpleUploadedFile(
            "certificate.pdf",
            b"%PDF-1.4" + b"x" * 1024,
            content_type="application/pdf"
        )
        
        data = {
            'national_id': '1234567890',
            'full_name': 'Wrong Name',  # Doesn't match applicant
            'title': 'Test Certificate',
            'certificate_type': 'Bachelor',
            'pdf_file': pdf_file
        }
        
        url = reverse('institution-certificates-prepare')
        response = self.institution_client.post(url, data, format='multipart')
        
        self.assertEqual(response.status_code, 400)
    
    @patch('api.certificates.events.emit')
    def test_confirm_certificate_success(self, mock_emit):
        """ISSUE-009 [CRITICAL]: Confirm certificate after blockchain transaction."""
        data = {
            'national_id': '1234567890',
            'title': 'Bachelor Degree',
            'certificate_type': 'Bachelor',
            'cid': 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
            'file_hash': _unique_hash(),
            'applicant_id_hash': '0x' + 'b' * 64,
            'tx_hash': _unique_hash(),
            'block_number': 1000,
            'contract_address': '0x' + 'c' * 40
        }
        
        url = reverse('institution-certificates-confirm')
        response = self.institution_client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data['success'])
        self.assertIn('certificate_id', response.data)
    
    def test_confirm_duplicate_file_hash(self):
        """ISSUE-010 [CRITICAL]: Confirm with existing file_hash fails."""
        # Create a certificate first
        cert = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            created_by_user=self.institution_user,
            display_label="Existing Certificate",
            file_hash=_unique_hash(),
            tx_hash=_unique_hash(),
            block_number=1000,
        )
        
        data = {
            'national_id': '1234567890',
            'title': 'Duplicate Certificate',
            'certificate_type': 'Bachelor',
            'cid': 'bafytest123',
            'file_hash': cert.file_hash,  # DUPLICATE!
            'applicant_id_hash': '0x' + 'b' * 64,
            'tx_hash': _unique_hash(),
            'block_number': 2000,
            'contract_address': '0x' + 'c' * 40
        }
        
        url = reverse('institution-certificates-confirm')
        response = self.institution_client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, 400)
    
    @patch('api.certificates.events.emit')
    def test_confirm_triggers_event(self, mock_emit):
        """ISSUE-015: Confirm triggers email notification event."""
        data = {
            'national_id': '1234567890',
            'title': 'Bachelor Degree Event Test',
            'certificate_type': 'Bachelor',
            'cid': 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
            'file_hash': _unique_hash(),
            'applicant_id_hash': '0x' + 'b' * 64,
            'tx_hash': _unique_hash(),
            'block_number': 1000,
            'contract_address': '0x' + 'c' * 40
        }
        
        url = reverse('institution-certificates-confirm')
        response = self.institution_client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, 201, f"Failed: {response.data}")
        mock_emit.assert_called()


# ============================================================================
#                 CERTIFICATE MANAGEMENT TESTS
# ============================================================================

class CertificateManagementTest(IntegrationTestSetup):
    """Integration tests for certificate management."""
    
    def setUp(self):
        super().setUp()
        self.certificate = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            created_by_user=self.institution_user,
            display_label="Management Test Certificate",
            certificate_type="Bachelor",
            file_cid="bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
            file_hash=_unique_hash(),
            tx_hash=_unique_hash(),
            block_number=1000,
        )
    
    def test_list_certificates_success(self):
        """MGMT-001: Institution lists their certificates."""
        url = reverse('institution-certificates-list')
        response = self.institution_client.get(url)
        
        self.assertEqual(response.status_code, 200)
        self.assertIn('results', response.data)
        self.assertGreaterEqual(response.data['count'], 1)
    
    def test_retrieve_certificate_success(self):
        """MGMT-003: Institution retrieves single certificate."""
        url = reverse('institution-certificates-detail', kwargs={'pk': self.certificate.id})
        response = self.institution_client.get(url)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['id'], self.certificate.id)
        self.assertEqual(response.data['display_label'], self.certificate.display_label)
        self.assertIn('file_hash', response.data)
        self.assertIn('tx_hash', response.data)
    
    def test_search_certificates(self):
        """MGMT-009: Search certificates by applicant name."""
        url = reverse('institution-certificates-list')
        response = self.institution_client.get(url, {'search': 'John'})
        
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(response.data['count'], 1)
    
    def test_unauthenticated_access_denied(self):
        """MGMT-011: Unauthenticated user denied."""
        url = reverse('institution-certificates-list')
        response = self.client.get(url)  # Unauthenticated client
        
        self.assertEqual(response.status_code, 401)


# ============================================================================
#                    APPLICANT ACCESS TESTS
# ============================================================================

class ApplicantAccessTest(IntegrationTestSetup):
    """Integration tests for applicant certificate access."""
    
    def setUp(self):
        super().setUp()
        self.certificate = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            created_by_user=self.institution_user,
            display_label="Applicant Access Test Certificate",
            certificate_type="Bachelor",
            file_cid="bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
            file_hash=_unique_hash(),
            tx_hash=_unique_hash(),
            block_number=1000,
        )
        
        self.other_certificate = Certificate.objects.create(
            institution=self.institution,
            applicant=self.second_applicant,
            created_by_user=self.institution_user,
            display_label="Other Applicant Certificate",
            certificate_type="Master",
            file_hash=_unique_hash(),
            tx_hash=_unique_hash(),
            block_number=1001,
        )
    
    def test_list_own_certificates(self):
        """APP-001: Applicant lists their certificates."""
        url = reverse('my-certificates-list')
        response = self.applicant_client.get(url)
        
        self.assertEqual(response.status_code, 200)
        self.assertIn('results', response.data)
        self.assertGreaterEqual(response.data['count'], 1)
    
    def test_retrieve_own_certificate(self):
        """APP-008: Applicant retrieves own certificate."""
        url = reverse('my-certificates-detail', kwargs={'pk': self.certificate.id})
        response = self.applicant_client.get(url)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['id'], self.certificate.id)
        self.assertIn('institution_name', response.data)
    
    def test_cannot_access_others_certificate(self):
        """APP-009 [CRITICAL]: Cannot access another applicant's certificate."""
        url = reverse('my-certificates-detail', kwargs={'pk': self.other_certificate.id})
        response = self.applicant_client.get(url)
        
        self.assertEqual(response.status_code, 404)


# ============================================================================
#                     FILE DOWNLOAD TESTS
# ============================================================================

class FileDownloadTest(IntegrationTestSetup):
    """Integration tests for certificate file download."""
    
    def setUp(self):
        super().setUp()
        self.certificate = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            created_by_user=self.institution_user,
            display_label="Download Test Certificate",
            certificate_type="Bachelor",
            file_cid="bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
            file_hash=_unique_hash(),
            tx_hash=_unique_hash(),
            block_number=1000,
        )
        
        self.certificate_no_file = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            created_by_user=self.institution_user,
            display_label="No File Certificate",
            file_cid="",  # No file!
            file_hash=_unique_hash(),
            tx_hash=_unique_hash(),
            block_number=1001,
        )
        
        self.revoked_certificate = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            created_by_user=self.institution_user,
            display_label="Revoked Certificate",
            file_cid="bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
            file_hash=_unique_hash(),
            tx_hash=_unique_hash(),
            block_number=1002,
            revoked_at=timezone.now(),
            revoke_tx_hash=_unique_hash(),
            revoke_block_number=2000,
        )
    
    def test_download_certificate_file(self):
        """FILE-001: Download certificate file (redirect to IPFS)."""
        url = reverse('institution-certificates-file', kwargs={'pk': self.certificate.id})
        response = self.institution_client.get(url)
        
        self.assertEqual(response.status_code, 302)
        self.assertIn(self.certificate.file_cid, response.url)
    
    def test_download_no_file_cid(self):
        """FILE-002: Download without file_cid fails."""
        url = reverse('institution-certificates-file', kwargs={'pk': self.certificate_no_file.id})
        response = self.institution_client.get(url)
        
        self.assertEqual(response.status_code, 404)
    
    def test_download_revoked_certificate(self):
        """FILE-003 [CRITICAL]: Download revoked certificate blocked."""
        url = reverse('institution-certificates-file', kwargs={'pk': self.revoked_certificate.id})
        response = self.institution_client.get(url)
        
        self.assertEqual(response.status_code, 403)
    
    def test_applicant_download_own_certificate(self):
        """FILE-004: Applicant downloads their own certificate."""
        url = reverse('my-certificates-file', kwargs={'pk': self.certificate.id})
        response = self.applicant_client.get(url)
        
        self.assertEqual(response.status_code, 302)
        self.assertIn(self.certificate.file_cid, response.url)
    
    def test_applicant_download_revoked_blocked(self):
        """FILE-005: Applicant cannot download revoked certificate."""
        url = reverse('my-certificates-file', kwargs={'pk': self.revoked_certificate.id})
        response = self.applicant_client.get(url)
        
        # Either 403 (revoked) or 404 (not their certificate)
        self.assertIn(response.status_code, [403, 404])


# ============================================================================
#                  CERTIFICATE REVOCATION TESTS
# ============================================================================

class CertificateRevocationTest(IntegrationTestSetup):
    """Integration tests for certificate revocation."""
    
    def setUp(self):
        super().setUp()
        self.certificate = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            created_by_user=self.institution_user,
            display_label="Revocation Test Certificate",
            certificate_type="Bachelor",
            file_cid="bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
            file_hash=_unique_hash(),
            tx_hash=_unique_hash(),
            block_number=1000,
        )
    
    def test_revoke_certificate_success(self):
        """REVOKE-001 [CRITICAL]: Revoke certificate."""
        data = {
            'tx_hash': _unique_hash(),
            'block_number': 2000,
            'reason': 'Test revocation'
        }
        
        url = reverse('institution-certificates-revoke', kwargs={'pk': self.certificate.id})
        response = self.institution_client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data.get('success'))
        
        self.certificate.refresh_from_db()
        self.assertIsNotNone(self.certificate.revoked_at)
        self.assertEqual(self.certificate.revoke_tx_hash, data['tx_hash'])
    
    def test_revoke_missing_tx_hash(self):
        """REVOKE-004: Revoke without tx_hash fails."""
        data = {
            'block_number': 2000,
            'reason': 'Test'
            # tx_hash MISSING!
        }
        
        url = reverse('institution-certificates-revoke', kwargs={'pk': self.certificate.id})
        response = self.institution_client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, 400)
    
    def test_download_after_revoke_blocked(self):
        """REVOKE-008: Download after revoke is blocked."""
        # First revoke
        revoke_data = {
            'tx_hash': _unique_hash(),
            'block_number': 2000,
        }
        
        revoke_url = reverse('institution-certificates-revoke', kwargs={'pk': self.certificate.id})
        self.institution_client.post(revoke_url, revoke_data, format='json')
        
        # Then try to download
        file_url = reverse('institution-certificates-file', kwargs={'pk': self.certificate.id})
        response = self.institution_client.get(file_url)
        
        self.assertEqual(response.status_code, 403)


# ============================================================================
#                 BLOCKCHAIN VERIFICATION TESTS
# ============================================================================

class BlockchainVerificationTest(IntegrationTestSetup):
    """Integration tests for blockchain verification."""
    
    def setUp(self):
        super().setUp()
        self.certificate = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            created_by_user=self.institution_user,
            display_label="Verification Test Certificate",
            certificate_type="Bachelor",
            file_hash=_unique_hash(),
            tx_hash=_unique_hash(),
            block_number=1000,
        )
    
    @patch('api.certificates.views._get_blockchain_service')
    def test_verify_batch_success(self, mock_get_service):
        """VERIFY-001: Verify certificates on blockchain."""
        mock_service = Mock()
        mock_service.verify_certificates_batch.return_value = [{
            'file_hash': self.certificate.file_hash,
            'exists': True,
            'certificate_type': 'Bachelor',
            'issue_date': 1704067200,
            'is_revoked': False,
        }]
        mock_get_service.return_value = mock_service
        
        data = {
            'file_hashes': [self.certificate.file_hash]
        }
        
        url = reverse('institution-certificates-verify-batch')
        response = self.institution_client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, 200)
        self.assertIn('results', response.data)
    
    @patch('api.certificates.views._get_blockchain_service')
    def test_applicant_verify_batch(self, mock_get_service):
        """VERIFY-002: Applicant verifies their certificates."""
        mock_service = Mock()
        mock_service.verify_certificates_batch.return_value = [{
            'file_hash': self.certificate.file_hash,
            'exists': True,
            'certificate_type': 'Bachelor',
            'issue_date': 1704067200,
            'is_revoked': False,
        }]
        mock_get_service.return_value = mock_service
        
        data = {
            'file_hashes': [self.certificate.file_hash]
        }
        
        url = reverse('my-certificates-verify-batch')
        response = self.applicant_client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, 200)
        self.assertIn('results', response.data)


# ============================================================================
#                    PERMISSION INTEGRATION TESTS
# ============================================================================

class PermissionIntegrationTest(IntegrationTestSetup):
    """Integration tests for role-based access control."""
    
    def test_applicant_cannot_access_institution_endpoints(self):
        """PERM-INT-001: Applicant cannot access institution endpoints."""
        url = reverse('institution-certificates-list')
        response = self.applicant_client.get(url)
        
        self.assertEqual(response.status_code, 403)
    
    def test_institution_cannot_access_applicant_endpoints(self):
        """PERM-INT-002: Institution cannot access applicant endpoints."""
        url = reverse('my-certificates-list')
        response = self.institution_client.get(url)
        
        self.assertEqual(response.status_code, 403)
    
    def test_employer_cannot_access_certificate_endpoints(self):
        """PERM-INT-003: Employer cannot access certificate endpoints."""
        # Try institution endpoint
        url = reverse('institution-certificates-list')
        response = self.employer_client.get(url)
        self.assertEqual(response.status_code, 403)
        
        # Try applicant endpoint
        url = reverse('my-certificates-list')
        response = self.employer_client.get(url)
        self.assertEqual(response.status_code, 403)


# ============================================================================
#                    FULL FLOW INTEGRATION TESTS
# ============================================================================

class FullFlowIntegrationTest(IntegrationTestSetup):
    """End-to-end integration tests."""
    
    @patch('api.certificates.views._upload_to_storacha')
    @patch('api.certificates.events.emit')
    def test_full_issuance_flow(self, mock_emit, mock_storacha):
        """FLOW-001: Complete issuance: prepare → confirm → applicant views"""
        mock_storacha.return_value = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"
        
        # Step 1: Prepare
        pdf_file = SimpleUploadedFile(
            "certificate.pdf",
            b"%PDF-1.4" + b"x" * (1024 * 100),
            content_type="application/pdf"
        )
        
        prepare_data = {
            'national_id': '1234567890',
            'full_name': 'John Doe',
            'title': 'Bachelor of Computer Science',
            'certificate_type': 'Bachelor',
            'pdf_file': pdf_file
        }
        
        prepare_url = reverse('institution-certificates-prepare')
        prepare_response = self.institution_client.post(
            prepare_url, prepare_data, format='multipart'
        )
        
        self.assertEqual(prepare_response.status_code, 200)
        blockchain_data = prepare_response.data['blockchain_data']
        
        # Step 2: Confirm
        confirm_data = {
            'national_id': '1234567890',
            'title': 'Bachelor of Computer Science',
            'certificate_type': 'Bachelor',
            'cid': blockchain_data['cid'],
            'file_hash': blockchain_data['file_hash'],
            'applicant_id_hash': blockchain_data['applicant_id_hash'],
            'contract_address': self.institution.contract_address,
            'tx_hash': _unique_hash(),
            'block_number': 12345,
        }
        
        confirm_url = reverse('institution-certificates-confirm')
        confirm_response = self.institution_client.post(
            confirm_url, confirm_data, format='json'
        )
        
        self.assertEqual(confirm_response.status_code, 201)
        cert_id = confirm_response.data['certificate_id']
        
        # Step 3: Applicant views
        view_url = reverse('my-certificates-detail', kwargs={'pk': cert_id})
        view_response = self.applicant_client.get(view_url)
        
        self.assertEqual(view_response.status_code, 200)
        self.assertEqual(view_response.data['display_label'], 'Bachelor of Computer Science')
    
    def test_full_revocation_flow(self):
        """FLOW-002: Revoke → download blocked for both parties"""
        # Create a certificate for this test
        cert = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            created_by_user=self.institution_user,
            display_label="Certificate for Revocation Flow",
            certificate_type="Bachelor",
            file_cid="bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
            file_hash=_unique_hash(),
            applicant_id_hash="0x" + "b" * 64,
            contract_address=self.institution.contract_address,
            tx_hash=_unique_hash(),
            block_number=5000,
        )
        
        # Step 1: Revoke
        revoke_data = {
            'tx_hash': _unique_hash(),
            'block_number': 99999,
            'reason': 'Issued in error'
        }
        
        revoke_url = reverse('institution-certificates-revoke', kwargs={'pk': cert.id})
        revoke_response = self.institution_client.post(
            revoke_url, revoke_data, format='json'
        )
        
        self.assertEqual(revoke_response.status_code, 200)
        
        # Step 2: Institution cannot download
        file_url = reverse('institution-certificates-file', kwargs={'pk': cert.id})
        file_response = self.institution_client.get(file_url)
        
        self.assertEqual(file_response.status_code, 403)
        
        # Step 3: Applicant cannot download
        my_file_url = reverse('my-certificates-file', kwargs={'pk': cert.id})
        my_file_response = self.applicant_client.get(my_file_url)
        
        self.assertEqual(my_file_response.status_code, 403)