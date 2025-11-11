# backend/api/access/tests.py

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase, APIClient
from unittest import mock

from django.contrib.auth import get_user_model

from api.accounts.models import Applicant, Employer, Institution
from api.certificates.models import Certificate
from api.access.models import AccessRequest, AccessShare


User = get_user_model()


class AccessFlowTests(APITestCase):
    """Complete test suite for access flow"""
    
    def setUp(self):
        self.client = APIClient()

        # Institution user
        self.u_inst = User.objects.create_user(
            email="inst@example.com",
            password="pw",
            role=User.Roles.INSTITUTION
        )
        self.inst = Institution.objects.create(
            user=self.u_inst,
            institution_name="Uni A",
            official_email="oa@uni.test",
            status=Institution.Status.APPROVED,
        )

        # Applicant user
        self.u_app = User.objects.create_user(
            email="app@example.com",
            password="pw",
            role=User.Roles.APPLICANT
        )
        self.applicant = Applicant.objects.create(
            user=self.u_app,
            full_name="Alice Applicant",
            national_id_plain="1111111111",
            national_id_hash="0x" + "11" * 32,
            phone="0000",
        )

        # Employer user (HR)
        self.u_emp = User.objects.create_user(
            email="hr@example.com",
            password="pw",
            role=User.Roles.EMPLOYER
        )
        self.employer = Employer.objects.create(
            user=self.u_emp,
            full_name="Bob HR",
            work_email="hr@co.test",
            company_name="Co Ltd",
            cr_number_plain="CR-123",
            verifier_id_hash="0x" + "aa" * 32,
            status=Employer.Status.APPROVED,
        )

        # Another employer (to test access control)
        self.u_emp2 = User.objects.create_user(
            email="hr2@example.com",
            password="pw",
            role=User.Roles.EMPLOYER
        )
        self.employer2 = Employer.objects.create(
            user=self.u_emp2,
            full_name="Eve HR",
            work_email="hr2@co.test",
            company_name="Other Co",
            cr_number_plain="CR-456",
            verifier_id_hash="0x" + "bb" * 32,
            status=Employer.Status.APPROVED,
        )

        # One issued certificate for the applicant
        self.cert = Certificate.objects.create(
            institution=self.inst,
            applicant=self.applicant,
            created_by_user=self.u_inst,
            file_hash="0x" + "12" * 32,
            cid_enc="bafyenc..",
            enc_nonce="00" * 32,
            enc_tag="11" * 32,
            enc_key_protected="22" * 64,
            display_label="Degree",
            issued_on="2024-01-01",
            serial_number="S-1",
            status="ISSUED_ONCHAIN",
            tx_hash="0xabc",
            block_number=1,
        )

    # ============ Employer creates request ============

    def test_employer_create_request_success(self):
        """Employer can create access request"""
        self.client.force_authenticate(self.u_emp)
        url = reverse("employer-requests-list")
        resp = self.client.post(
            url,
            {"applicant_national_id": "1111111111", "note": "please"},
            format="json"
        )
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertEqual(AccessRequest.objects.count(), 1)
        ar = AccessRequest.objects.first()
        self.assertEqual(ar.status, AccessRequest.Status.PENDING)
        self.assertEqual(ar.employer, self.employer)
        self.assertEqual(ar.applicant, self.applicant)

    def test_employer_duplicate_pending_is_blocked(self):
        """Duplicate pending requests are blocked"""
        self.client.force_authenticate(self.u_emp)
        url = reverse("employer-requests-list")
        self.client.post(url, {"applicant_national_id": "1111111111"}, format="json")
        resp = self.client.post(url, {"applicant_national_id": "1111111111"}, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn(b"pending request already exists", resp.content.lower())

    # ============ Applicant views requests ============

    def _mk_pending_request(self):
        """Helper: Create pending request"""
        return AccessRequest.objects.create(
            employer=self.employer,
            applicant=self.applicant,
            note="n"
        )

    def test_applicant_list_and_retrieve(self):
        """Applicant can view their requests"""
        ar = self._mk_pending_request()
        self.client.force_authenticate(self.u_app)
        url_list = reverse("applicant-requests-list")
        url_detail = reverse("applicant-requests-detail", args=[ar.id])
        r1 = self.client.get(url_list)
        r2 = self.client.get(url_detail)
        self.assertEqual(r1.status_code, 200)
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.data["id"], ar.id)

    # ============ Approve flow (NO blockchain) ============

    def test_applicant_approves_without_blockchain(self):
        """✅ NEW: Approval is database-only (no blockchain call)"""
        ar = self._mk_pending_request()
        self.client.force_authenticate(self.u_app)
        url = reverse("applicant-requests-approve", args=[ar.id])
        
        # Approve without any blockchain mocking
        resp = self.client.post(url, {"certificate_ids": [self.cert.id]}, format="json")
        
        self.assertEqual(resp.status_code, 200, resp.content)
        
        # Check database updates
        ar.refresh_from_db()
        self.assertEqual(ar.status, AccessRequest.Status.APPROVED)
        self.assertIsNotNone(ar.decided_at)
        
        # Check AccessShare created
        self.assertEqual(AccessShare.objects.filter(request=ar).count(), 1)
        share = AccessShare.objects.filter(request=ar).first()
        self.assertEqual(share.certificate, self.cert)
        
        # Response structure
        self.assertIn('status', resp.data)
        self.assertEqual(resp.data['status'], 'approved')
        self.assertIn('certificates_shared', resp.data)
        self.assertEqual(resp.data['certificates_shared'], 1)

    def test_applicant_approves_multiple_certificates(self):
        """Applicant can approve multiple certificates at once"""
        
        # Create second certificate
        cert2 = Certificate.objects.create(
            institution=self.inst,
            applicant=self.applicant,
            created_by_user=self.u_inst,
            file_hash="0x" + "34" * 32,
            cid_enc="bafyenc2..",
            enc_nonce="00" * 32,
            enc_tag="11" * 32,
            enc_key_protected="22" * 64,
            display_label="Master's Degree",
            issued_on="2024-06-01",
            serial_number="S-2",
            status="ISSUED_ONCHAIN",
            tx_hash="0xdef",
            block_number=2,
        )
        
        ar = self._mk_pending_request()
        self.client.force_authenticate(self.u_app)
        url = reverse("applicant-requests-approve", args=[ar.id])
        
        # Approve both certificates
        resp = self.client.post(
            url,
            {"certificate_ids": [self.cert.id, cert2.id]},
            format="json"
        )
        
        self.assertEqual(resp.status_code, 200)
        ar.refresh_from_db()
        self.assertEqual(ar.status, AccessRequest.Status.APPROVED)
        
        # Check both shares created
        self.assertEqual(AccessShare.objects.filter(request=ar).count(), 2)
        self.assertEqual(resp.data['certificates_shared'], 2)

    # ============ Decline flow ============

    def test_applicant_declines(self):
        """Applicant can decline request"""
        ar = self._mk_pending_request()
        self.client.force_authenticate(self.u_app)
        url = reverse("applicant-requests-decline", args=[ar.id])
        resp = self.client.post(url, {}, format="json")
        self.assertEqual(resp.status_code, 200)
        ar.refresh_from_db()
        self.assertEqual(ar.status, AccessRequest.Status.DECLINED)
        self.assertIsNotNone(ar.decided_at)

    # ============ Validation ============

    def test_approve_rejects_non_owned_certificates(self):
        """Cannot approve certificates not owned by applicant"""
        
        ar = self._mk_pending_request()
        
        # Create certificate for different applicant
        other_u = User.objects.create_user(
            email="other@app.test",
            password="pw",
            role=User.Roles.APPLICANT
        )
        other_app = Applicant.objects.create(
            user=other_u,
            full_name="Other",
            national_id_plain="2222222222",
            national_id_hash="0x" + "22" * 32,
            phone="1111"
        )
        other_cert = Certificate.objects.create(
            institution=self.inst,
            applicant=other_app,
            created_by_user=self.u_inst,
            file_hash="0x" + "34" * 32,
            cid_enc="x",
            enc_nonce="00" * 32,
            enc_tag="11" * 32,
            enc_key_protected="22" * 64,
            display_label="OtherCert",
            issued_on="2024-02-02",
            serial_number="S-2",
            status="ISSUED_ONCHAIN"
        )

        self.client.force_authenticate(self.u_app)
        url = reverse("applicant-requests-approve", args=[ar.id])
        
        # Try to approve both owned and non-owned certificate
        resp = self.client.post(
            url,
            {"certificate_ids": [self.cert.id, other_cert.id]},
            format="json"
        )
        
        self.assertEqual(resp.status_code, 400)
        self.assertIn(b"invalid", resp.content.lower())
        
        # Request should still be pending
        ar.refresh_from_db()
        self.assertEqual(ar.status, AccessRequest.Status.PENDING)
        
        # No shares should be created
        self.assertEqual(AccessShare.objects.filter(request=ar).count(), 0)

    # ============ Employer reads shared list ============

    @mock.patch('api.access.views.get_certificates_batch')  # ✅ FIX: Mock where it's imported
    def test_employer_shared_with_blockchain_verification(self, mock_blockchain):
        """✅ NEW: Employer viewing calls blockchain for verification"""
        # Mock blockchain response (certificate is valid)
        mock_blockchain.return_value = [{
            'file_hash': self.cert.file_hash,
            'applicant_id_hash': self.applicant.national_id_hash,
            'issued_at': 1699459200,
            'revoked': False,
            'exists': True
        }]
        
        ar = self._mk_pending_request()
        
        # Applicant approves
        self.client.force_authenticate(self.u_app)
        self.client.post(
            reverse("applicant-requests-approve", args=[ar.id]),
            {"certificate_ids": [self.cert.id]},
            format="json"
        )
        
        # Employer views shared certificates
        self.client.force_authenticate(self.u_emp)
        r_ok = self.client.get(reverse("employer-requests-shared", args=[ar.id]))
        
        self.assertEqual(r_ok.status_code, 200)
        
        # Blockchain verification was called
        mock_blockchain.assert_called_once()
        
        # Certificate is in results
        certs = r_ok.data.get("certificates", r_ok.data.get("results", []))
        self.assertEqual(len(certs), 1)

    @mock.patch('api.access.views.get_certificates_batch')  # ✅ FIX: Mock where it's imported
    def test_employer_cannot_see_revoked_certificates(self, mock_blockchain):
        """✅ NEW: Revoked certificates filtered out by blockchain check"""
        # Mock blockchain response (certificate is revoked)
        mock_blockchain.return_value = [{
            'file_hash': self.cert.file_hash,
            'applicant_id_hash': self.applicant.national_id_hash,
            'issued_at': 1699459200,
            'revoked': True,  # ⚠️ REVOKED
            'exists': True
        }]
        
        ar = self._mk_pending_request()
        
        # Applicant approves
        self.client.force_authenticate(self.u_app)
        self.client.post(
            reverse("applicant-requests-approve", args=[ar.id]),
            {"certificate_ids": [self.cert.id]},
            format="json"
        )
        
        # Employer tries to view shared certificates
        self.client.force_authenticate(self.u_emp)
        r = self.client.get(reverse("employer-requests-shared", args=[ar.id]))
        
        self.assertEqual(r.status_code, 200)
        
        # Certificate should NOT be in results (filtered out)
        certs = r.data.get("certificates", r.data.get("results", []))
        self.assertEqual(len(certs), 0)

    def test_employer_shared_only_for_owner(self):
        """Only the employer who owns the request can view shared certificates"""
        
        ar = self._mk_pending_request()
        
        # Applicant approves
        self.client.force_authenticate(self.u_app)
        self.client.post(
            reverse("applicant-requests-approve", args=[ar.id]),
            {"certificate_ids": [self.cert.id]},
            format="json"
        )
        
        # Owner employer can see shared (will be mocked in real test)
        self.client.force_authenticate(self.u_emp)
        r_ok = self.client.get(reverse("employer-requests-shared", args=[ar.id]))
        self.assertEqual(r_ok.status_code, 200)
        
        # Other employer is forbidden
        self.client.force_authenticate(self.u_emp2)
        r_forbidden = self.client.get(reverse("employer-requests-shared", args=[ar.id]))
        self.assertEqual(r_forbidden.status_code, 404)

    # ============ Permissions ============

    def test_anonymous_forbidden(self):
        """Anonymous users are blocked"""
        url = reverse("employer-requests-list")
        self.client.logout()
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 401)

    def test_wrong_role_forbidden(self):
        """Wrong user roles are blocked"""
        
        # Applicant trying to use employer endpoint
        self.client.force_authenticate(self.u_app)
        resp = self.client.get(reverse("employer-requests-list"))
        self.assertEqual(resp.status_code, 403)
        
        # Employer trying to use applicant endpoint
        self.client.force_authenticate(self.u_emp)
        resp2 = self.client.get(reverse("applicant-requests-list"))
        self.assertEqual(resp2.status_code, 403)

    def test_cannot_approve_already_approved(self):
        """Cannot approve already approved request"""
        
        ar = self._mk_pending_request()
        self.client.force_authenticate(self.u_app)
        url = reverse("applicant-requests-approve", args=[ar.id])
        
        # First approval
        self.client.post(url, {"certificate_ids": [self.cert.id]}, format="json")
        
        # Try to approve again
        resp = self.client.post(url, {"certificate_ids": [self.cert.id]}, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn(b"not pending", resp.content.lower())

    def test_cannot_decline_already_declined(self):
        """Cannot decline already declined request"""
        
        ar = self._mk_pending_request()
        self.client.force_authenticate(self.u_app)
        
        # First decline
        self.client.post(reverse("applicant-requests-decline", args=[ar.id]))
        
        # Try to decline again
        resp = self.client.post(reverse("applicant-requests-decline", args=[ar.id]))
        self.assertEqual(resp.status_code, 400)

    def test_empty_certificate_list_rejected(self):
        """Cannot approve with empty certificate list"""
        
        ar = self._mk_pending_request()
        self.client.force_authenticate(self.u_app)
        url = reverse("applicant-requests-approve", args=[ar.id])
        
        resp = self.client.post(url, {"certificate_ids": []}, format="json")
        self.assertEqual(resp.status_code, 400)