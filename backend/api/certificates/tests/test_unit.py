# backend/api/certificates/tests/test_unit.py
"""
================================================================================
TAYAQAN Certificate Verification System
Unit Tests (Django TestCase Style)
================================================================================

📍 Location: backend/api/certificates/tests/test_unit.py
🏃 Run: python manage.py test api.certificates.tests.test_unit

================================================================================
"""

from datetime import date
from django.test import TestCase, RequestFactory
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.utils import timezone
from unittest.mock import Mock, patch

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


# ============================================================================
#                     BASE TEST SETUP
# ============================================================================

class CertificateTestSetup(TestCase):
    """Base setup for all certificate unit tests."""
    
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


# ============================================================================
#                     CERTIFICATE MODEL TESTS
# ============================================================================

class CertificateModelTest(CertificateTestSetup):
   
    def test_create_certificate_with_all_fields(self):
        
        cert = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            created_by_user=self.institution_user,
            display_label="Bachelor of Computer Science",
            certificate_type="Bachelor",
            file_cid="bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
            file_hash="0x" + "model001" * 8,
            applicant_id_hash="0x" + "b" * 64,
            contract_address="0x" + "c" * 40,
            tx_hash="0x" + "d" * 64,
            block_number=1000,
            issued_on=date(2024, 1, 15)
        )
        
        self.assertIsNotNone(cert.id)
        self.assertEqual(cert.institution, self.institution)
        self.assertEqual(cert.applicant, self.applicant)
        self.assertEqual(cert.display_label, "Bachelor of Computer Science")
        self.assertEqual(cert.certificate_type, "Bachelor")
    
    def test_auto_populate_national_id_plain(self): 
      
        cert = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            created_by_user=self.institution_user,
            display_label="Test Certificate",
            file_hash="0x" + "model002" * 8,
        )
        
        cert.refresh_from_db()
        
        self.assertIsNotNone(cert.national_id_plain)
        self.assertEqual(cert.national_id_plain, self.applicant.national_id_plain)
    
    def test_blockchain_url_property(self):
   
        tx_hash = "0x" + "abc123" * 10 + "abcd"
        
        cert = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            created_by_user=self.institution_user,
            display_label="Test Certificate",
            file_hash="0x" + "model003" * 8,
            tx_hash=tx_hash,
        ) 
        
        expected_url = f"https://etherscan.io/tx/{tx_hash}"
        self.assertEqual(cert.blockchain_url, expected_url)
    
    def test_blockchain_url_none_when_no_tx_hash(self):
       
        cert = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            created_by_user=self.institution_user,
            display_label="Test Certificate",
            file_hash="0x" + "model004" * 8,
            tx_hash="",
        )
        
        self.assertIsNone(cert.blockchain_url)
    
    def test_is_on_blockchain_property_true(self):
        """MODEL-005a: is_on_blockchain when all data present."""
        cert = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            created_by_user=self.institution_user,
            display_label="On Blockchain",
            file_hash="0x" + "model005a" * 7 + "a",
            tx_hash="0x" + "tx005" * 12 + "abcd",
            block_number=1000,
            contract_address="0x" + "c" * 40,
        )
        
        self.assertTrue(cert.is_on_blockchain)
    
    def test_is_on_blockchain_property_false(self):
        """MODEL-005b: is_on_blockchain without blockchain data."""
        cert = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            created_by_user=self.institution_user,
            display_label="Off Blockchain",
            file_hash="0x" + "model005b" * 7 + "b",
        )
        
        self.assertFalse(cert.is_on_blockchain)
    
    def test_is_on_blockchain_false_partial_data(self):
        """MODEL-006: is_on_blockchain with only tx_hash (no block_number)."""
        cert = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            created_by_user=self.institution_user,
            display_label="Partial Blockchain",
            file_hash="0x" + "model006" * 8,
            tx_hash="0x" + "tx006" * 12 + "abcd",
          
        )
        
        self.assertFalse(cert.is_on_blockchain)

        expected_url = f"https://etherscan.io/tx/{cert.tx_hash}"
        self.assertEqual(cert.blockchain_url, expected_url)
    
    def test_unique_file_hash_constraint(self):
        
        unique_hash = "0x" + "unique007" * 7 + "a"
        
        Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            created_by_user=self.institution_user,
            display_label="First Certificate",
            file_hash=unique_hash,
        )
        
        with self.assertRaises(IntegrityError):
            Certificate.objects.create(
                institution=self.institution,
                applicant=self.applicant,
                created_by_user=self.institution_user,
                display_label="Duplicate Certificate",
                file_hash=unique_hash,  
            )
    
    def test_certificate_string_representation(self):
        """MODEL-008: Certificate __str__ method."""
        cert = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            created_by_user=self.institution_user,
            display_label="Master Degree",
            file_hash="0x" + "model008" * 8,
        )
        
        cert_str = str(cert)
        self.assertIn("Master Degree", cert_str)
        self.assertIn(self.applicant.full_name, cert_str)
    
    def test_revocation_fields_update(self):
        """MODEL-009: Update revocation fields."""
        cert = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            created_by_user=self.institution_user,
            display_label="To Revoke",
            file_hash="0x" + "model009" * 8,
        )
        
        revoke_tx = "0x" + "revoke009" * 7 + "a"
        revoke_block = 99999
        
        cert.revoke_tx_hash = revoke_tx
        cert.revoke_block_number = revoke_block
        cert.revoked_at = timezone.now()
        cert.save()
        
        cert.refresh_from_db()
        
        self.assertEqual(cert.revoke_tx_hash, revoke_tx)
        self.assertEqual(cert.revoke_block_number, revoke_block)
        self.assertIsNotNone(cert.revoked_at)
    
    def test_certificate_ordering(self):
        """MODEL-010: Certificates ordered by -created_at."""
        import time
        
        cert1 = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            display_label="First",
            file_hash="0x" + "order1" * 10 + "aaaa",
        )
        
        time.sleep(0.01)
        
        cert2 = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            display_label="Second",
            file_hash="0x" + "order2" * 10 + "bbbb",
        )
        
        certs = list(Certificate.objects.all())
        self.assertEqual(certs[0], cert2)  # Newer first
        self.assertEqual(certs[1], cert1)


# ============================================================================
#                      VALIDATOR TESTS
# ============================================================================

class ValidatorTest(TestCase): 
    
    
    def test_valid_pdf_passes_validation(self):
        
        from api.certificates.validators import validate_pdf_file
        
        pdf_file = SimpleUploadedFile(
            "test.pdf",
            b"%PDF-1.4" + b"x" * (1024 * 1024),
            content_type="application/pdf"
        )
        
        
        try:
            validate_pdf_file(pdf_file)
        except ValidationError:
            self.fail("Valid PDF should pass validation")
    
    def test_invalid_extension_rejected(self):
       
        from api.certificates.validators import validate_pdf_file
        
        txt_file = SimpleUploadedFile(
            "test.txt",
            b"This is not a PDF",
            content_type="text/plain"
        )
        
        with self.assertRaises(ValidationError) as ctx:
            validate_pdf_file(txt_file)
        
        self.assertIn("PDF", str(ctx.exception))
    
    def test_file_too_large_rejected(self):
        
        from api.certificates.validators import validate_pdf_file
        
        large_pdf = SimpleUploadedFile(
            "large.pdf",
            b"%PDF-1.4" + b"x" * 100,
            content_type="application/pdf"
        )
        large_pdf.size = 6 * 1024 * 1024  
        
        with self.assertRaises(ValidationError) as ctx:
            validate_pdf_file(large_pdf)
        
        self.assertIn("large", str(ctx.exception).lower())
    
    def test_case_insensitive_extension(self):
        """VALID-008: Uppercase .PDF extension passes."""
        from api.certificates.validators import validate_pdf_file
        
        pdf_file = SimpleUploadedFile(
            "test.PDF",
            b"%PDF-1.4" + b"x" * (1024 * 1024),
            content_type="application/pdf"
        )
        
        try:
            validate_pdf_file(pdf_file)
        except ValidationError:
            self.fail("Uppercase .PDF should be accepted")


# ============================================================================
#                       PERMISSION TESTS
# ============================================================================

class PermissionTest(CertificateTestSetup):
    
    
    def test_institution_user_permission_granted(self):
       
        from api.certificates.permissions import IsInstitutionUser
        
        factory = RequestFactory()
        request = factory.get('/')
        request.user = self.institution_user
        
        permission = IsInstitutionUser()
        self.assertTrue(permission.has_permission(request, None))
    
    def test_institution_user_permission_denied_to_applicant(self):
        
        from api.certificates.permissions import IsInstitutionUser
        
        factory = RequestFactory()
        request = factory.get('/')
        request.user = self.applicant_user
        
        permission = IsInstitutionUser()
        self.assertFalse(permission.has_permission(request, None))
    
    def test_institution_user_permission_denied_to_employer(self):
        
        from api.certificates.permissions import IsInstitutionUser
        
        factory = RequestFactory()
        request = factory.get('/')
        request.user = self.employer_user
        
        permission = IsInstitutionUser()
        self.assertFalse(permission.has_permission(request, None))
    
    def test_institution_user_permission_denied_to_anonymous(self):
        
        from api.certificates.permissions import IsInstitutionUser
        
        factory = RequestFactory()
        request = factory.get('/')
        request.user = Mock(is_authenticated=False)
        
        permission = IsInstitutionUser()
        self.assertFalse(permission.has_permission(request, None))
    
    def test_applicant_user_permission_granted(self):
        """PERM-006: Applicant user gets permission."""
        from api.certificates.permissions import IsApplicantUser
        
        factory = RequestFactory()
        request = factory.get('/')
        request.user = self.applicant_user
        
        permission = IsApplicantUser()
        self.assertTrue(permission.has_permission(request, None))
    
    def test_applicant_user_permission_denied_to_institution(self):
        """PERM-007: Institution denied applicant permission."""
        from api.certificates.permissions import IsApplicantUser
        
        factory = RequestFactory()
        request = factory.get('/')
        request.user = self.institution_user
        
        permission = IsApplicantUser()
        self.assertFalse(permission.has_permission(request, None))
    
    def test_applicant_user_permission_denied_to_employer(self):
        """PERM-008: Employer denied applicant permission."""
        from api.certificates.permissions import IsApplicantUser
        
        factory = RequestFactory()
        request = factory.get('/')
        request.user = self.employer_user
        
        permission = IsApplicantUser()
        self.assertFalse(permission.has_permission(request, None))


# ============================================================================
#                       EVENT SYSTEM TESTS
# ============================================================================

class EventSystemTest(TestCase):
    
    
    def test_register_event_handler(self):
        
        from api.certificates.events import register, _observers
        
        original = _observers.get("certificate_issued", []).copy()
        
        mock_handler = Mock()
        register("certificate_issued", mock_handler)
        
        self.assertIn(mock_handler, _observers["certificate_issued"])
        
       
        _observers["certificate_issued"] = original
    
    def test_emit_event_calls_handler(self):
       
        from api.certificates.events import register, emit, _observers
        
        original = _observers.get("certificate_issued", []).copy()
        _observers["certificate_issued"] = []
        
        mock_handler = Mock()
        register("certificate_issued", mock_handler)
        
        payload = {"certificate_id": 123}
        emit("certificate_issued", payload)
        
        mock_handler.assert_called_once_with(payload)
        
       
        _observers["certificate_issued"] = original
    
    def test_certificate_issued_function(self):
        
        from api.certificates.events import certificate_issued, register, _observers
        
        original = _observers.get("certificate_issued", []).copy()
        _observers["certificate_issued"] = []
        
        mock_handler = Mock()
        register("certificate_issued", mock_handler)
        
        mock_cert = Mock(id=999)
        certificate_issued(mock_cert)
        
        mock_handler.assert_called_once_with(mock_cert)
        
        
        _observers["certificate_issued"] = original


# ============================================================================
#                    EMAIL HANDLER TESTS
# ============================================================================

class EmailHandlerTest(CertificateTestSetup):
   
    
    def setUp(self):
       
        self.certificate = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            created_by_user=self.institution_user,
            display_label="Email Test Certificate",
            certificate_type="Bachelor",
            file_hash="0x" + "email" * 12 + "aaaa",
            tx_hash="0x" + "emailtx" * 9 + "a",
            block_number=5000,
        )
    
    @patch('api.certificates.handlers.EmailMultiAlternatives')
    def test_send_email_on_certificate_issuance(self, mock_email_class):
        
        from api.certificates.handlers import _handle_certificate_issued
        
        mock_email_instance = Mock()
        mock_email_class.return_value = mock_email_instance
        
        _handle_certificate_issued(self.certificate)
        
        mock_email_class.assert_called_once()
        mock_email_instance.send.assert_called_once()
    
    @patch('api.certificates.handlers.EmailMultiAlternatives')
    def test_email_content_correct(self, mock_email_class):
        """EMAIL-002: Email content is correct."""
        from api.certificates.handlers import _handle_certificate_issued
        
        mock_email_instance = Mock()
        mock_email_class.return_value = mock_email_instance
        
        _handle_certificate_issued(self.certificate)
        
        call_kwargs = mock_email_class.call_args.kwargs
        
        
        subject = call_kwargs["subject"].lower()
        self.assertTrue("certificate" in subject or "issued" in subject)
        
       
        self.assertIn(self.certificate.applicant.user.email, call_kwargs["to"])


# ============================================================================
#                    SERIALIZER TESTS
# ============================================================================

class SerializerTest(CertificateTestSetup):
    
    
    def setUp(self):
        """Create test files and certificates."""
        self.small_pdf_file = SimpleUploadedFile(
            "small_certificate.pdf",
            b"%PDF-1.4" + b"x" * (1024 * 100),
            content_type="application/pdf"
        )
        
        self.certificate = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            created_by_user=self.institution_user,
            display_label="Serializer Test Certificate",
            certificate_type="Bachelor",
            file_hash="0x" + "serial" * 10 + "aaaa",
            tx_hash="0x" + "sertx" * 12 + "abcd",
            block_number=6000,
        )
    
    def test_prepare_issue_serializer_valid(self):
        """SER-001: Valid data for PrepareIssueSerializer."""
        from api.certificates.serializers import PrepareIssueSerializer
        
        data = {
            'national_id': '1234567890',
            'full_name': 'John Doe',
            'title': 'Bachelor Degree',
            'certificate_type': 'Bachelor',
            'issued_on': '2024-01-15',
            'pdf_file': self.small_pdf_file,
        }
        
        serializer = PrepareIssueSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
    
    def test_prepare_issue_serializer_missing_fields(self):
        """SER-002: Missing required fields fails."""
        from api.certificates.serializers import PrepareIssueSerializer
        
        serializer = PrepareIssueSerializer(data={})
        
        self.assertFalse(serializer.is_valid())
        self.assertIn('national_id', serializer.errors)
        self.assertIn('full_name', serializer.errors)
        self.assertIn('title', serializer.errors)
        self.assertIn('pdf_file', serializer.errors)
    
    def test_confirm_issue_serializer_valid(self):
        """SER-003: Valid data for ConfirmIssueSerializer."""
        from api.certificates.serializers import ConfirmIssueSerializer
        
        data = {
            'national_id': '1234567890',
            'title': 'Bachelor Degree',
            'certificate_type': 'Bachelor',
            'issued_on': '2024-01-15',
            'cid': 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
            'file_hash': '0x' + 'ser003valid' * 5 + 'aaa',
            'applicant_id_hash': '0x' + 'b' * 64,
            'contract_address': '0x' + 'c' * 40,
            'tx_hash': '0x' + 'ser003tx' * 8,
            'block_number': 12345,
        }
        
        serializer = ConfirmIssueSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
    
    def test_confirm_issue_serializer_duplicate_file_hash(self):
        """SER-004: Duplicate file_hash fails validation."""
        from api.certificates.serializers import ConfirmIssueSerializer
        
        data = {
            'national_id': '1234567890',
            'title': 'Duplicate',
            'certificate_type': 'Bachelor',
            'cid': 'bafytest',
            'file_hash': self.certificate.file_hash,  # DUPLICATE!
            'applicant_id_hash': '0x' + 'b' * 64,
            'contract_address': '0x' + 'c' * 40,
            'tx_hash': '0x' + 'newtx' * 12 + 'abcd',
        }
        
        serializer = ConfirmIssueSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('file_hash', serializer.errors)
    
    def test_certificate_list_serializer_output(self):
        """SER-005: CertificateListSerializer output fields."""
        from api.certificates.serializers import CertificateListSerializer
        
        serializer = CertificateListSerializer(self.certificate)
        data = serializer.data
        
        self.assertIn('id', data)
        self.assertIn('display_label', data)
        self.assertIn('applicant_full_name', data)
        self.assertIn('institution_name', data)
        self.assertIn('file_hash', data)
        self.assertIn('tx_hash', data)
        
        self.assertEqual(data['display_label'], self.certificate.display_label)
        self.assertEqual(data['applicant_full_name'], self.certificate.applicant.full_name)