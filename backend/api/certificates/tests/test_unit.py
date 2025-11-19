"""Unit tests for Certificate model."""

from django.test import TestCase
from django.contrib.auth import get_user_model
from api.accounts.models import Applicant, Institution
from api.certificates.models import Certificate
from eth_hash.auto import keccak

User = get_user_model()


def generate_national_id_hash(national_id: str) -> str:
    """Generate keccak256 hash of national ID."""
    return "0x" + keccak(national_id.encode("utf-8")).hex()


class CertificateModelTest(TestCase):
    """Test Certificate model."""

    def setUp(self):
        """Create test data."""
        # Create institution user
        inst_user = User.objects.create_user(
            email="ksu@example.com",
            password="test123",
            role=User.Roles.INSTITUTION
        )
        self.institution = Institution.objects.create(
            user=inst_user,
            institution_name="KSU",
            official_email="ksu@example.com",
            phone="+966501234567",
            wallet_address="0x" + "1" * 40,
            status=Institution.Status.APPROVED,
            institution_id="KSU-001",
            contract_address="0x" + "2" * 40,
        )

        # Create applicant user - manually set hash
        app_user = User.objects.create_user(
            email="ahmad@example.com",
            password="test123",
            role=User.Roles.APPLICANT
        )
        self.applicant = Applicant.objects.create(
            user=app_user,
            full_name="Ahmad Ali",
            national_id_plain="1234567890",
            national_id_hash=generate_national_id_hash("1234567890"),
            phone="+966501234567",
            wallet_address="0x" + "3" * 40,
        )

    def test_create_certificate(self):
        """Test creating a certificate."""
        cert = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            file_cid="bafytest123",
            display_label="Bachelor of Computer Science",
            issued_on="2024-01-15",
            applicant_id_hash="0xabc123",
        )

        self.assertEqual(cert.institution, self.institution)
        self.assertEqual(cert.applicant, self.applicant)
        self.assertEqual(cert.file_cid, "bafytest123")
        self.assertIn("Ahmad Ali", str(cert))

    def test_certificate_ordering(self):
        """Test certificates are ordered by creation date (newest first)."""
        cert1 = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            file_cid="cid1",
            display_label="Cert 1",
            applicant_id_hash="0x1",
        )
        cert2 = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            file_cid="cid2",
            display_label="Cert 2",
            applicant_id_hash="0x2",
        )

        certs = list(Certificate.objects.all())
        self.assertEqual(certs[0], cert2)  # Newest first
        self.assertEqual(certs[1], cert1)

    def test_certificate_has_required_fields(self):
        """Test certificate has all required fields."""
        cert = Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            file_cid="bafytest456",
            display_label="Master Degree",
            applicant_id_hash="0xdef456",
        )

        self.assertIsNotNone(cert.id)
        self.assertIsNotNone(cert.created_at)
        self.assertIsNotNone(cert.updated_at)
        self.assertEqual(cert.file_cid, "bafytest456")
        self.assertEqual(cert.applicant_id_hash, "0xdef456")

    def test_applicant_has_national_id_hash(self):
        """Test that applicant's national_id_hash is set correctly."""
        # Check hash exists and is not empty
        self.assertIsNotNone(self.applicant.national_id_hash)
        self.assertNotEqual(self.applicant.national_id_hash, "")
        self.assertTrue(self.applicant.national_id_hash.startswith("0x"))
        
        # Verify it's the correct hash
        expected_hash = generate_national_id_hash("1234567890")
        self.assertEqual(self.applicant.national_id_hash, expected_hash)