"""Integration tests for Certificate API."""

from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from api.accounts.models import Applicant, Institution
from api.certificates.models import Certificate
from eth_hash.auto import keccak

User = get_user_model()


def generate_national_id_hash(national_id: str) -> str:
    """Generate keccak256 hash of national ID."""
    return "0x" + keccak(national_id.encode("utf-8")).hex()


class CertificateAPITest(TestCase):
    """Test Certificate API endpoints."""

    def setUp(self):
        """Create test users and authenticate."""
        # Create institution
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

        # Create applicant - manually set hash
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

        # API clients
        self.inst_client = APIClient()
        self.inst_client.force_authenticate(user=inst_user)

        self.app_client = APIClient()
        self.app_client.force_authenticate(user=app_user)

    def _get_results(self, response_data):
        """Extract results from response (handles both list and paginated)."""
        if isinstance(response_data, list):
            return response_data
        elif isinstance(response_data, dict) and "results" in response_data:
            return response_data["results"]
        return []

    def test_institution_can_list_certificates(self):
        """Test institution can list their issued certificates."""
        # Create test certificate
        Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            file_cid="bafytest123",
            display_label="Test Cert",
            applicant_id_hash="0xabc",
        )

        response = self.inst_client.get("/api/certificates/institution/")
        
        self.assertEqual(response.status_code, 200)
        results = self._get_results(response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["display_label"], "Test Cert")

    def test_applicant_can_view_own_certificates(self):
        """Test applicant can view their certificates."""
        # Create certificate for THIS applicant
        Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            file_cid="bafytest123",
            display_label="My Degree",
            applicant_id_hash="0xabc",
        )

        response = self.app_client.get("/api/certificates/my/")
        
        self.assertEqual(response.status_code, 200)
        results = self._get_results(response.data)
        self.assertGreaterEqual(len(results), 1)
        
        # Check that our certificate is in the response
        cert_labels = [cert["display_label"] for cert in results]
        self.assertIn("My Degree", cert_labels)

    def test_applicant_cannot_see_others_certificates(self):
        """Test applicant only sees their own certificates."""
        # Create another applicant with DIFFERENT national ID
        other_user = User.objects.create_user(
            email="other@example.com",
            password="test123",
            role=User.Roles.APPLICANT
        )
        
        other_applicant = Applicant.objects.create(
            user=other_user,
            full_name="Other Person",
            national_id_plain="9876543210",
            national_id_hash=generate_national_id_hash("9876543210"),
            phone="+966501111111",
            wallet_address="0x" + "4" * 40,
        )

        # Create certificate for OTHER applicant
        Certificate.objects.create(
            institution=self.institution,
            applicant=other_applicant,
            file_cid="bafytest456",
            display_label="Other Person's Cert",
            applicant_id_hash="0xdef",
        )

        # Get certificates for FIRST applicant
        response = self.app_client.get("/api/certificates/my/")
        
        self.assertEqual(response.status_code, 200)
        results = self._get_results(response.data)
        
        # Check that OTHER person's certificate is NOT in response
        cert_labels = [cert["display_label"] for cert in results]
        self.assertNotIn("Other Person's Cert", cert_labels)

    def test_institution_only_sees_own_certificates(self):
        """Test institution only sees certificates they issued."""
        # Create another institution
        other_inst_user = User.objects.create_user(
            email="uod@example.com",
            password="test123",
            role=User.Roles.INSTITUTION
        )
        other_institution = Institution.objects.create(
            user=other_inst_user,
            institution_name="UOD",
            official_email="uod@example.com",
            phone="+966502222222",
            wallet_address="0x" + "5" * 40,
            status=Institution.Status.APPROVED,
            institution_id="UOD-001",
            contract_address="0x" + "6" * 40,
        )

        # Certificate from OUR institution
        Certificate.objects.create(
            institution=self.institution,
            applicant=self.applicant,
            file_cid="bafyksu123",
            display_label="KSU Certificate",
            applicant_id_hash="0xabc",
        )

        # Certificate from OTHER institution
        Certificate.objects.create(
            institution=other_institution,
            applicant=self.applicant,
            file_cid="bafyuod456",
            display_label="UOD Certificate",
            applicant_id_hash="0xdef",
        )

        # Get certificates for FIRST institution
        response = self.inst_client.get("/api/certificates/institution/")
        
        self.assertEqual(response.status_code, 200)
        results = self._get_results(response.data)
        
        # Check that only OUR certificate is returned
        cert_labels = [cert["display_label"] for cert in results]
        self.assertIn("KSU Certificate", cert_labels)
        self.assertNotIn("UOD Certificate", cert_labels)

    def test_unauthenticated_cannot_access(self):
        """Test unauthenticated users cannot access certificates."""
        unauth_client = APIClient()
        
        # Try institution endpoint
        response = unauth_client.get("/api/certificates/institution/")
        self.assertEqual(response.status_code, 401)
        
        # Try applicant endpoint
        response = unauth_client.get("/api/certificates/my/")
        self.assertEqual(response.status_code, 401)