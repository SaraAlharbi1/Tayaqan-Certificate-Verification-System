"""
Certificate issuance and retrieval APIs.

Endpoints:
- Institution:
  * GET  /api/certificates/institution/              - List certificates
  * GET  /api/certificates/institution/{id}/         - Get details
  * GET  /api/certificates/institution/{id}/file/    - Download PDF (✅ FIXED: redirect to Storacha)
  * POST /api/certificates/institution/prepare/      - Prepare issuance
  * POST /api/certificates/institution/confirm/      - Confirm issuance
  * POST /api/certificates/institution/verify-batch/ - Verify on blockchain
  * POST /api/certificates/institution/{id}/revoke/  - Revoke certificate (frontend handles blockchain)

- Applicant:
  * GET  /api/certificates/my/              - List my certificates
  * GET  /api/certificates/my/{id}/         - Get details
  * GET  /api/certificates/my/{id}/file/    - Download PDF (✅ FIXED: redirect to Storacha)
  * POST /api/certificates/my/verify-batch/ - Verify on blockchain
"""

import hashlib
import json
import os
import subprocess
import tempfile
from eth_hash.auto import keccak
from django.utils import timezone

from django.db.models import Q
from django.http import FileResponse, HttpResponse
from django.shortcuts import redirect
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from api.accounts.models import Applicant
from .models import Certificate
from .permissions import IsInstitutionUser, IsApplicantUser
from .serializers import (
    PrepareIssueSerializer,
    ConfirmIssueSerializer,
    CertificateListSerializer,
    CertificateDetailSerializer,
    MyCertificateListSerializer,
    MyCertificateDetailSerializer,
    VerifyBatchRequestSerializer,
    VerifyBatchResponseSerializer,
    RevokeRequestSerializer,
)
from .events import certificate_issued


# ============================================================
# Storacha Helpers
# ============================================================

def _upload_to_storacha(pdf_file):
    """Upload PDF to Storacha using Node.js script."""
    script_path = os.path.join(
        os.path.dirname(__file__),
        "..", "..", "helpers", "storacha_upload.js"
    )

    if not os.path.exists(script_path):
        raise RuntimeError(f"Storacha upload script not found: {script_path}")

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        for chunk in pdf_file.chunks():
            tmp.write(chunk)
        tmp_path = tmp.name

    try:
        result = subprocess.run(
            ["node", script_path, tmp_path],
            capture_output=True,
            text=True,
            check=True
        )
        output = json.loads(result.stdout)
        return output["cid"]
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Storacha upload failed: {e.stderr}")
    except json.JSONDecodeError:
        raise RuntimeError("Invalid response from Storacha script")
    finally:
        os.unlink(tmp_path)





# ============================================================
# Hash Helpers
# ============================================================

def _hash_text(text: str) -> str:
    return "0x" + keccak(text.encode("utf-8")).hex()


def _hash_file(file_content: bytes) -> str:
    return "0x" + hashlib.sha256(file_content).hexdigest()


# ============================================================
# Blockchain Service
# ============================================================

def _get_blockchain_service(contract_address: str):
    from helpers.blockchain_service import create_blockchain_service
    return create_blockchain_service(contract_address)


# ============================================================
# Pagination
# ============================================================

class CertificatePagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


# ============================================================
# Institution Certificate ViewSet
# ============================================================

class InstitutionCertificateViewSet(viewsets.ReadOnlyModelViewSet):

    permission_classes = [IsAuthenticated, IsInstitutionUser]
    serializer_class = CertificateListSerializer
    pagination_class = CertificatePagination

    def get_queryset(self):
        institution = self.request.user.institution
        qs = Certificate.objects.filter(institution=institution)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(applicant__full_name__icontains=search)
                | Q(national_id_plain__icontains=search)
            )

        date_from = self.request.query_params.get("issued_on__gte")
        if date_from:
            qs = qs.filter(issued_on__gte=date_from)

        date_to = self.request.query_params.get("issued_on__lte")
        if date_to:
            qs = qs.filter(issued_on__lte=date_to)

        return qs.order_by("-id")

    def get_serializer_class(self):
        if self.action == "retrieve":
            return CertificateDetailSerializer
        return CertificateListSerializer

    # ----------------------------------------------------------
    # Prepare
    # ----------------------------------------------------------
    @action(detail=False, methods=["post"], url_path="prepare")
    def prepare(self, request):
        serializer = PrepareIssueSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            applicant = Applicant.objects.get(
                national_id_plain=data["national_id"]
            )
        except Applicant.DoesNotExist:
            return Response({"error": "Applicant not found"}, status=404)

        if applicant.full_name.lower() != data["full_name"].lower():
            return Response({"error": "Applicant name mismatch"}, status=400)

        pdf_content = data["pdf_file"].read()
        file_hash = _hash_file(pdf_content)
        data["pdf_file"].seek(0)

        try:
            cid = _upload_to_storacha(data["pdf_file"])
        except Exception as e:
            return Response({"error": str(e)}, status=500)

        applicant_id_hash = _hash_text(applicant.national_id_plain)

        return Response({
            "success": True,
            "blockchain_data": {
                "file_hash": file_hash,
                "applicant_id_hash": applicant_id_hash,
                "cid": cid,
            },
            "applicant_info": {
                "name": applicant.full_name,
                "wallet": applicant.wallet_address,
            }
        })

    # ----------------------------------------------------------
    # Confirm
    # ----------------------------------------------------------
    @action(detail=False, methods=["post"], url_path="confirm")
    def confirm(self, request):
        serializer = ConfirmIssueSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        institution = request.user.institution

        try:
            applicant = Applicant.objects.get(
                national_id_plain=data["national_id"]
            )
        except Applicant.DoesNotExist:
            return Response({"error": "Applicant not found"}, status=404)

        cert = Certificate.objects.create(
            institution=institution,
            applicant=applicant,
            created_by_user=request.user,
            file_cid=data["cid"],
            display_label=data["title"],
            issued_on=data.get("issued_on"),
            national_id_plain=applicant.national_id_plain,
            file_hash=data["file_hash"],
            applicant_id_hash=data["applicant_id_hash"],
            contract_address=data["contract_address"],
            tx_hash=data["tx_hash"],
            block_number=data.get("block_number"),
        )

        certificate_issued(cert)

        return Response({"success": True, "certificate_id": cert.id}, status=201)

    # ----------------------------------------------------------
    # File Download (✅ FIXED: Redirect to Storacha)
    # ----------------------------------------------------------
    @action(detail=True, methods=["get"], url_path="file")
    def file(self, request, pk=None):
        """
        GET /api/certificates/institution/{id}/file/
        
        ✅ FIXED: Redirect to Storacha gateway for direct download.
        Institution can download certificates they issued.
        """
        cert = self.get_object()

        if not cert.file_cid:
            return Response({"error": "File not found"}, status=404)

        # Check if certificate is revoked
        if cert.revoked_at:
            return Response(
                {"error": "Certificate has been revoked"},
                status=status.HTTP_403_FORBIDDEN
            )

        # ✅ REDIRECT TO STORACHA
        gateway_url = f"https://{cert.file_cid}.ipfs.w3s.link"
        return redirect(gateway_url)

    # ----------------------------------------------------------
    # Batch Verify
    # ----------------------------------------------------------
    @action(detail=False, methods=["post"], url_path="verify-batch")
    def verify_batch(self, request):
        serializer = VerifyBatchRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        file_hashes = serializer.validated_data["file_hashes"]

        certs = Certificate.objects.filter(
            institution=request.user.institution,
            file_hash__in=file_hashes
        )

        grouped = {}
        for cert in certs:
            if cert.contract_address:
                grouped.setdefault(cert.contract_address, []).append(cert.file_hash)

        results = []
        for contract_addr, hashes in grouped.items():
            service = _get_blockchain_service(contract_addr)
            if service:
                results.extend(service.verify_certificates_batch(hashes))

        return Response({"results": results})

    # ----------------------------------------------------------
    # REVOKE (UPDATED: frontend handles blockchain)
    # ----------------------------------------------------------
    @action(detail=True, methods=["post"], url_path="revoke")
    def revoke(self, request, pk=None):
        """
        Update certificate revocation status in database.
        Frontend handles blockchain transaction with institution's wallet.
        
        Request:
            - tx_hash: Transaction hash from MetaMask
            - block_number: Block number (optional)
            - reason: Optional reason
        
        Response:
            - success: True
            - tx_hash
            - block_number
        """
        cert = self.get_object()

        tx_hash = request.data.get("tx_hash")
        block_number = request.data.get("block_number")
        reason = request.data.get("reason", "")

        if not tx_hash:
            return Response({"error": "tx_hash required"}, status=400)

        cert.revoke_tx_hash = tx_hash
        cert.revoke_block_number = block_number
        cert.revoked_at = timezone.now()
        if hasattr(cert, "revoke_reason"):
            cert.revoke_reason = reason
        cert.save()

        return Response({
            "success": True,
            "tx_hash": tx_hash,
            "block_number": block_number,
        })


# ============================================================
# Applicant Certificate ViewSet
# ============================================================

class MyCertificateViewSet(viewsets.ReadOnlyModelViewSet):

    permission_classes = [IsAuthenticated, IsApplicantUser]
    pagination_class = CertificatePagination

    def get_queryset(self):
        return Certificate.objects.filter(
            applicant=self.request.user.applicant
        ).order_by("-id")

    def get_serializer_class(self):
        if self.action == "retrieve":
            return MyCertificateDetailSerializer
        return MyCertificateListSerializer

    # ----------------------------------------------------------
    # File Download (✅ FIXED: Redirect to Storacha)
    # ----------------------------------------------------------
    @action(detail=True, methods=["get"], url_path="file")
    def file(self, request, pk=None):
        """
        GET /api/certificates/my/{id}/file/
        
        ✅ FIXED: Redirect to Storacha gateway for direct download.
        Applicant can download their own certificates.
        """
        cert = self.get_object()

        if not cert.file_cid:
            return Response({"error": "File not found"}, status=404)

        # Check if certificate is revoked
        if cert.revoked_at:
            return Response(
                {"error": "Certificate has been revoked"},
                status=status.HTTP_403_FORBIDDEN
            )

        # ✅ REDIRECT TO STORACHA
        gateway_url = f"https://{cert.file_cid}.ipfs.w3s.link"
        return redirect(gateway_url)

    # ----------------------------------------------------------
    # Batch Verify
    # ----------------------------------------------------------
    @action(detail=False, methods=["post"], url_path="verify-batch")
    def verify_batch(self, request):
        serializer = VerifyBatchRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        file_hashes = serializer.validated_data["file_hashes"]

        certs = Certificate.objects.filter(
            applicant=request.user.applicant,
            file_hash__in=file_hashes
        )

        grouped = {}
        for cert in certs:
            if cert.contract_address:
                grouped.setdefault(cert.contract_address, []).append(cert.file_hash)

        results = []
        for contract_addr, hashes in grouped.items():
            service = _get_blockchain_service(contract_addr)
            if service:
                results.extend(service.verify_certificates_batch(hashes))

        return Response({"results": results})