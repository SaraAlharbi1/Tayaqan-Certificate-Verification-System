# backend/api/certificates/views.py
"""
Certificate endpoints.

- Institutions: list/retrieve, issue, revoke, download.
- Applicants:   list/retrieve, verify-batch, download.
- Employers:    GLOBAL detail/tx/file (per your rule).
- Sensitive crypto material is never returned in API payloads.
"""
import os
import sys
import json
import base64
import tempfile
import subprocess
import secrets
from pathlib import Path
from typing import Dict, List, Tuple, Optional

from django.shortcuts import get_object_or_404
from django.db import transaction, IntegrityError
from django.db.models import QuerySet
from django.http import HttpResponse

from rest_framework import viewsets, mixins, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend

from rest_framework_simplejwt.authentication import JWTAuthentication

from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter
from drf_spectacular.openapi import OpenApiTypes

from Crypto.Cipher import AES
from Crypto.Hash import keccak

from .models import Certificate
from .serializers import (
    CertificateListSerializer,
    CertificateDetailSerializer,
)
from api.accounts.models import Institution, Applicant
from utils.blockchain_service import BlockchainService


# ------------------------- small helpers (focused, reusable) -------------------------

def _keccak256_hex(b: bytes) -> str:
    """Bytes -> 0x + 64 hex (Solidity-compatible)."""
    k = keccak.new(digest_bits=256)
    k.update(b)
    return "0x" + k.hexdigest()


def _aes_gcm_encrypt(data: bytes) -> Tuple[bytes, bytes, bytes, bytes]:
    """AES-GCM encrypt bytes -> (key, nonce, tag, ciphertext)."""
    key = secrets.token_bytes(32)
    nonce = secrets.token_bytes(12)
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    ct, tag = cipher.encrypt_and_digest(data)
    return key, nonce, tag, ct


def _aes_gcm_decrypt(enc_bytes: bytes, key_hex: str, nonce_hex: str, tag_hex: str) -> bytes:
    """AES-GCM decrypt using hex inputs -> raw bytes."""
    key = bytes.fromhex(key_hex)
    nonce = bytes.fromhex(nonce_hex)
    tag = bytes.fromhex(tag_hex)
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    return cipher.decrypt_and_verify(enc_bytes, tag)


def _resolve_institution(user) -> Institution:
    return get_object_or_404(Institution, user=user)


def _resolve_applicant(user) -> Applicant:
    return get_object_or_404(Applicant, user=user)


def _api_err(status_code: int, code: str, user_message: str, detail=None):
    return Response({"code": code, "user_message": user_message, "detail": detail or {}}, status=status_code)


def err_400(code, msg, d=None): return _api_err(status.HTTP_400_BAD_REQUEST, code, msg, d)
def err_403(code, msg, d=None): return _api_err(status.HTTP_403_FORBIDDEN, code, msg, d)
def err_404(code, msg, d=None): return _api_err(status.HTTP_404_NOT_FOUND, code, msg, d)
def err_409(code, msg, d=None): return _api_err(status.HTTP_409_CONFLICT, code, msg, d)
def err_500(code, msg, d=None): return _api_err(status.HTTP_500_INTERNAL_SERVER_ERROR, code, msg, d)


def _norm_hash(h: str) -> str:
    """Normalize to 0x + 64 lower-hex."""
    if not h:
        return ""
    h = str(h).strip().lower()
    return h if h.startswith("0x") else ("0x" + h)


def _coerce_bool(x) -> bool:
    """Accept bool/str-int flags from helpers."""
    if isinstance(x, bool):
        return x
    return str(x).strip().lower() in ("true", "1", "yes")


def _run_node(args: List[str], *, timeout=60) -> dict:
    """Run a node script and parse JSON output."""
    out = subprocess.check_output(args, text=True, stderr=subprocess.STDOUT, timeout=timeout, env=os.environ.copy())
    return json.loads(out)


def _fetch_cid_bytes(cid: str, *, timeout=60) -> bytes:
    """Fetch encrypted bytes (base64) from storage by CID."""
    data = _run_node(["node", "utils/fetch_cid.js", cid], timeout=timeout)
    b64 = data.get("bytes_b64")
    if not b64:
        raise ValueError("empty content from storage")
    return base64.b64decode(b64)


# ------------------------- pagination -------------------------

class CertificatePagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


# ========================= Institution scope =========================

@extend_schema_view(
    list=extend_schema(
        tags=["2. Certificates"],
        summary="01. List certificates for the current institution",
        operation_id="02_certificates_list",
        parameters=[
            OpenApiParameter(name="search", type=OpenApiTypes.STR, required=False),
            OpenApiParameter(name="ordering", type=OpenApiTypes.STR, required=False),
            OpenApiParameter(name="page", type=OpenApiTypes.INT, required=False),
        ],
        responses={200: CertificateListSerializer(many=True)},
    ),
    retrieve=extend_schema(
        tags=["2. Certificates"],
        summary="02. Get certificate details (institution-scoped)",
        operation_id="02_certificates_retrieve",
        responses={200: CertificateDetailSerializer, 404: {"description": "Not found"}},
    ),
)
class InstitutionCertificateViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Institution list/detail; includes on-chain status + tx in retrieve."""
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = CertificatePagination

    filterset_fields = {"issued_on": ["gte", "lte"]}
    search_fields = ["display_label", "serial_number", "applicant__full_name", "applicant__national_id_plain"]
    ordering_fields = ["issued_on", "id", "created_at", "serial_number"]
    ordering = ["-issued_on", "-id"]

    def get_queryset(self) -> QuerySet:
        inst = _resolve_institution(self.request.user)
        return (
            Certificate.objects
            .filter(institution=inst)
            .select_related("applicant", "institution")
            .order_by(*self.ordering)
        )

    def get_serializer_class(self):
        return CertificateDetailSerializer if self.action == "retrieve" else CertificateListSerializer

    # ---- chain helpers (service-based) ----
    def _verify_batch_map(self, file_hashes: List[str]) -> Dict[str, dict]:
        ver = BlockchainService.verify_certificates_batch([_norm_hash(h) for h in (file_hashes or []) if h]) or {}
        return {(_norm_hash(k) or "").lower(): v for k, v in ver.items()}

    def _tx_info(self, file_hash: str) -> dict:
        return BlockchainService.get_transaction_info(_norm_hash(file_hash)) or {}

    # ---- GET /{id}/ (enrich with onchain status + tx) ----
    def retrieve(self, request, pk=None):
        inst = _resolve_institution(self.request.user)
        cert = get_object_or_404(
            Certificate.objects.filter(institution=inst).select_related("applicant", "institution"),
            pk=pk,
        )
        data = CertificateDetailSerializer(cert).data

        v = BlockchainService.verify_certificate(_norm_hash(cert.file_hash)) if cert.file_hash else {}
        info = self._tx_info(cert.file_hash) if cert.file_hash else {}

        exists = _coerce_bool(v.get("exists"))
        revoked = _coerce_bool(v.get("revoked"))
        onchain_status = "ACTIVE" if (exists and not revoked) else ("REVOKED" if revoked else "INVALID")

        data.update({
            "onchain_status": onchain_status,
            "tx_hash": info.get("revokeTx") or info.get("issuedTx"),
            "block_number": info.get("revokeBlock") or info.get("issuedBlock"),
            "issuedTx": info.get("issuedTx"),
            "issuedBlock": info.get("issuedBlock"),
            "revokeTx": info.get("revokeTx"),
            "revokeBlock": info.get("revokeBlock"),
        })
        return Response(data, status=200)

    # ---- POST /verify-batch ----
    @extend_schema(
        tags=["2. Certificates"],
        summary="03. Batch verify (by file_hash) on blockchain",
        operation_id="02_certificates_verify_batch",
        request={"application/json": {
            "type": "object",
            "properties": {"file_hashes": {"type": "array", "items": {"type": "string"}}},
            "required": ["file_hashes"]
        }},
        responses={200: {"type": "array", "items": {"type": "object"}}},
    )
    @action(methods=["post"], detail=False, url_path="verify-batch", parser_classes=[JSONParser])
    def verify_batch(self, request):
        hashes = (request.data or {}).get("file_hashes") or []
        if not isinstance(hashes, list) or not hashes:
            return err_400("missing_hashes", "file_hashes must be a non-empty array.")

        inst = _resolve_institution(self.request.user)
        allowed = set(Certificate.objects.filter(institution=inst, file_hash__in=hashes).values_list("file_hash", flat=True))
        to_check = [h for h in hashes if h in allowed]
        if not to_check:
            return Response([], status=200)

        ver_map = self._verify_batch_map(to_check)
        out = [{"fileHash": fh, "exists": _coerce_bool(v.get("exists")), "revoked": _coerce_bool(v.get("revoked"))}
               for fh, v in ver_map.items()]
        return Response(out, status=200)

    # ---- GET /{id}/tx-info ----
    @extend_schema(
        tags=["2. Certificates"],
        summary="04. Tx info (Issued/Revoked)",
        operation_id="02_certificates_tx_info",
        responses={200: {"type": "object"}},
    )
    @action(methods=["get"], detail=True, url_path="tx-info", permission_classes=[IsAuthenticated])
    def tx_info(self, request, pk=None):
        inst = _resolve_institution(self.request.user)
        cert = get_object_or_404(Certificate.objects.filter(institution=inst), pk=pk)
        info = self._tx_info(cert.file_hash)
        return Response(info or {}, status=200)

    # ---- GET /{id}/file ----
    @extend_schema(
        tags=["2. Certificates"],
        summary="05. Download (inline) the decrypted PDF",
        operation_id="02_certificates_file",
        responses={200: {"content": {"application/pdf": {}}}, 404: {"description": "Not found"}},
    )
    @action(methods=["get"], detail=True, url_path="file", permission_classes=[IsAuthenticated])
    def file(self, request, pk=None):
        inst = _resolve_institution(self.request.user)
        cert = get_object_or_404(Certificate.objects.filter(institution=inst).select_related("applicant"), pk=pk)

        if not cert.cid_blob:
            return err_500("missing_cid", "Encrypted file CID is missing.")

        try:
            enc_bytes = _fetch_cid_bytes(cert.cid_blob, timeout=60)
            pdf_bytes = _aes_gcm_decrypt(enc_bytes, cert.enc_key_protected, cert.enc_nonce, cert.enc_tag)
        except subprocess.CalledProcessError as e:
            return err_500("fetch_cid_failed", "Could not fetch encrypted file.", {"output": (e.output or "")[:400]})
        except subprocess.TimeoutExpired:
            return err_500("fetch_cid_timeout", "Timed out fetching encrypted file from storage.")
        except ValueError:
            return err_500("decryption_failed", "Decryption failed. Stored data may be corrupted.")
        except Exception as e:
            return err_500("file_download_failed", "Unexpected error while fetching/decrypting.", {"err": str(e)})

        resp = HttpResponse(pdf_bytes, content_type="application/pdf")
        resp["Content-Disposition"] = f'inline; filename="certificate_{cert.id}.pdf"'
        return resp

    # ---- POST /issue ----
    @extend_schema(
        tags=["2. Certificates"],
        summary="06. Issue a certificate (on-chain â†’ encrypt â†’ upload â†’ save)",
        operation_id="02_certificates_issue",
        request={
            "multipart/form-data": {
                "type": "object",
                "properties": {
                    "national_id": {"type": "string"},
                    "display_label": {"type": "string"},
                    "issued_on": {"type": "string", "format": "date"},
                    "serial_number": {"type": "string"},
                    "file": {"type": "string", "format": "binary"},
                },
                "required": ["national_id", "file"],
            }
        },
        responses={200: CertificateDetailSerializer, 400: {}, 403: {}, 409: {}, 500: {}},
    )
    @action(methods=["post"], detail=False, url_path="issue", permission_classes=[IsAuthenticated],
            parser_classes=[MultiPartParser, FormParser])
    def issue(self, request, *args, **kwargs):
        inst = _resolve_institution(request.user)
        if inst.status != "APPROVED":
            return err_403("institution_not_approved", "Institution is not approved yet.")

        national_id = request.data.get("national_id")
        file_obj = request.FILES.get("file")
        if not file_obj:
            return err_400("missing_file", "Please attach a PDF.")
        if file_obj.content_type != "application/pdf":
            return err_400("bad_file_type", "Only PDF files are allowed.")
        if not national_id:
            return err_400("missing_national_id", "National ID is required.")

        applicant = get_object_or_404(Applicant, national_id_plain=national_id)

        try:
            file_obj.seek(0)
        except Exception:
            pass
        file_bytes = file_obj.read()
        if not file_bytes:
            return err_400("empty_file", "Uploaded file is empty.")

        file_hash = _keccak256_hex(file_bytes)
        applicant_hash = applicant.national_id_hash

        if Certificate.objects.filter(institution=inst, file_hash=file_hash).exists():
            return err_409("duplicate_file_for_institution", "This exact file was already uploaded by your institution.",
                           {"file_hash": file_hash})

        # 1) On-chain
        proc = subprocess.run(
            [sys.executable, "utils/issue_onchain.py", applicant_hash, file_hash],
            text=True, capture_output=True, env={**os.environ, "PYTHONWARNINGS": "ignore"},
        )
        if proc.returncode != 0:
            body = proc.stderr or proc.stdout or ""
            return err_500("onchain_issue_failed", "Blockchain issuance failed.", {"output": body})

        try:
            onchain = json.loads((proc.stdout or "").strip())
        except Exception:
            return err_500("onchain_response_parse_failed", "Unexpected response from blockchain script.",
                           {"raw": proc.stdout})

        # 2) Encrypt + upload
        key, nonce, tag, enc_bytes = _aes_gcm_encrypt(file_bytes)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(enc_bytes)
            tmp_path = tmp.name

        token_file = os.getenv("STORACHA_TOKEN_FILE")
        if token_file and not os.getenv("STORACHA_PROOF"):
            p = Path(token_file)
            if p.exists():
                os.environ["STORACHA_PROOF"] = p.read_text(encoding="utf-8").strip()

        try:
            out = subprocess.check_output(["node", "utils/issue_upload.js", tmp_path],
                                          text=True, stderr=subprocess.STDOUT, env=os.environ.copy())
            data = json.loads(out)
            cid_blob = data.get("cid") or (data.get("root") or {}).get("/")
            if not cid_blob:
                raise ValueError(f"Unexpected uploader output: {out}")
        except subprocess.CalledProcessError as e:
            return err_500("storacha_upload_failed", "Encrypted file upload failed.", {"output": e.output})
        except (ValueError, json.JSONDecodeError) as e:
            return err_500("storacha_response_parse_failed", "Unexpected response from uploader.",
                           {"raw": out if 'out' in locals() else str(e)})
        finally:
            try:
                os.remove(tmp_path)
            except Exception:
                pass

        # 3) Persist
        try:
            with transaction.atomic():
                cert = Certificate.objects.create(
                    institution=inst,
                    applicant=applicant,
                    created_by_user=request.user,
                    file_hash=file_hash,
                    cid_blob=cid_blob,
                    enc_nonce=nonce.hex(),
                    enc_tag=tag.hex(),
                    enc_key_protected=key.hex(),   # stored server-side; NOT returned by serializers
                    display_label=request.data.get("display_label") or None,
                    issued_on=request.data.get("issued_on") or None,
                    serial_number=request.data.get("serial_number") or None,
                )
        except IntegrityError:
            return err_409("certificate_conflict",
                           "A certificate with the same file was already issued by your institution.",
                           {"file_hash": file_hash})

        data = CertificateDetailSerializer(cert).data
        info = BlockchainService.get_transaction_info(_norm_hash(cert.file_hash)) or {}
        data.update({
            "tx_hash": info.get("revokeTx") or info.get("issuedTx"),
            "block_number": info.get("revokeBlock") or info.get("issuedBlock"),
            "issuedTx": info.get("issuedTx"),
            "issuedBlock": info.get("issuedBlock"),
            "revokeTx": info.get("revokeTx"),
            "revokeBlock": info.get("revokeBlock"),
        })
        return Response(data, status=200)

    # ---- POST /{id}/revoke ----
    @extend_schema(
        tags=["2. Certificates"],
        summary="07. Revoke on-chain",
        operation_id="02_certificates_revoke",
        responses={200: {"type": "object"}},
    )
    @action(methods=["post"], detail=True, url_path="revoke", permission_classes=[IsAuthenticated])
    def revoke(self, request, pk=None):
        inst = _resolve_institution(self.request.user)
        cert = get_object_or_404(Certificate.objects.filter(institution=inst).select_related("applicant"), pk=pk)

        proc = subprocess.run(
            [sys.executable, "utils/revoke_onchain.py", cert.file_hash],
            text=True, capture_output=True, env={**os.environ, "PYTHONWARNINGS": "ignore"},
        )

        if proc.returncode != 0:
            out = (proc.stderr or proc.stdout or "")
            if "NotFound" in out:
                return err_404("onchain_not_found", "Certificate not found on-chain.", {"output": out})
            if "AlreadyRevoked" in out:
                info = BlockchainService.get_transaction_info(_norm_hash(cert.file_hash)) or {}
                return Response({"status": "REVOKED", **info}, status=200)
            return err_500("onchain_revoke_failed", "Blockchain revoke failed.", {"output": out})

        try:
            onchain = json.loads((proc.stdout or "").strip())
        except Exception:
            onchain = {}

        info = BlockchainService.get_transaction_info(_norm_hash(cert.file_hash)) or {}
        return Response({"status": "REVOKED", "revoke": onchain, "tx": info}, status=200)


# ========================= Applicant scope =========================

@extend_schema_view(
    list=extend_schema(
        tags=["4. My Certificates"],
        summary="01. List certificates owned by the current applicant",
        operation_id="04_mycerts_list",
        parameters=[
            OpenApiParameter(name="search", type=OpenApiTypes.STR, required=False),
            OpenApiParameter(name="ordering", type=OpenApiTypes.STR, required=False),
            OpenApiParameter(name="page", type=OpenApiTypes.INT, required=False),
        ],
        responses={200: CertificateListSerializer(many=True)},
    ),
    retrieve=extend_schema(
        tags=["4. My Certificates"],
        summary="02. My certificate details (with on-chain status + tx info)",
        operation_id="04_mycerts_retrieve",
        responses={200: {"type": "object"}, 404: {"description": "Not found"}},
    ),
)
class MyCertificatesViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Applicant list/detail + verify-batch + file (inline)."""
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    parser_classes = [JSONParser]
    pagination_class = CertificatePagination

    filterset_fields = {"issued_on": ["gte", "lte"]}
    search_fields = ["display_label", "serial_number", "institution__institution_name"]
    ordering_fields = ["issued_on", "id", "created_at", "serial_number"]
    ordering = ["-issued_on", "-id"]

    def get_queryset(self) -> QuerySet:
        applicant = _resolve_applicant(self.request.user)
        return (
            Certificate.objects
            .filter(applicant=applicant)
            .select_related("institution")
            .order_by(*self.ordering)
        )

    def get_serializer_class(self):
        return CertificateListSerializer

    # ---- chain helpers ----
    def _verify_batch_map(self, file_hashes: List[str]) -> Dict[str, dict]:
        ver = BlockchainService.verify_certificates_batch([_norm_hash(h) for h in (file_hashes or []) if h]) or {}
        return {(_norm_hash(k) or "").lower(): v for k, v in ver.items()}

    def _tx_info(self, file_hash: str) -> dict:
        return BlockchainService.get_transaction_info(_norm_hash(file_hash)) or {}

    # ---- POST /verify-batch ----
    @extend_schema(
        tags=["4. My Certificates"],
        summary="03. Batch verify my certificates",
        operation_id="04_mycerts_verify_batch",
        request={"application/json": {
            "type": "object",
            "properties": {"file_hashes": {"type": "array", "items": {"type": "string"}}},
            "required": ["file_hashes"]
        }},
        responses={200: {"type": "array", "items": {"type": "object"}}},
    )
    @action(methods=["post"], detail=False, url_path="verify-batch", parser_classes=[JSONParser])
    def verify_batch(self, request):
        body = request.data
        if not isinstance(body, dict):
            return err_400("bad_body", "Body must be JSON object with file_hashes array.")
        hashes = body.get("file_hashes")
        if not isinstance(hashes, list) or not hashes:
            return Response([], status=200)

        owned = set(self.get_queryset().filter(file_hash__in=hashes).values_list("file_hash", flat=True))
        to_check = [h for h in hashes if h in owned]
        if not to_check:
            return Response([], status=200)

        ver_map = self._verify_batch_map(to_check)
        out = [{"fileHash": fh, "exists": _coerce_bool(v.get("exists")), "revoked": _coerce_bool(v.get("revoked"))}
               for fh, v in ver_map.items()]
        return Response(out, status=200)

    # ---- GET /{id}/ ----
    def retrieve(self, request, pk=None):
        applicant = _resolve_applicant(request.user)
        cert = get_object_or_404(Certificate.objects.filter(applicant=applicant).select_related("institution"), pk=pk)

        v = BlockchainService.verify_certificate(_norm_hash(cert.file_hash)) if cert.file_hash else {}
        info = self._tx_info(cert.file_hash) if cert.file_hash else {}

        status_txt = "INVALID"
        if _coerce_bool(v.get("exists")):
            status_txt = "REVOKED" if _coerce_bool(v.get("revoked")) else "ACTIVE"

        return Response({
            "id": cert.id,
            "title": cert.display_label,
            "issuerName": getattr(cert.institution, "institution_name", None),
            "issueDate": cert.issued_on,
            "serial": cert.serial_number,
            "nationalId": getattr(cert.applicant, "national_id_plain", None),
            "status": status_txt,
            "tx_hash": info.get("issuedTx"),
            "block_number": info.get("issuedBlock"),
            "revoke_tx_hash": info.get("revokeTx"),
            "revoke_block_number": info.get("revokeBlock"),
        }, status=200)

    # ---- GET /{id}/file ----
    @extend_schema(
        tags=["4. My Certificates"],
        summary="04. Open my decrypted PDF (inline)",
        operation_id="04_mycerts_file",
        responses={200: {"content": {"application/pdf": {}}}, 410: {}, 404: {}},
    )
    @action(methods=["get"], detail=True, url_path="file", permission_classes=[IsAuthenticated])
    def file(self, request, pk=None):
        applicant = _resolve_applicant(request.user)
        cert = get_object_or_404(Certificate.objects.filter(applicant=applicant), pk=pk)

        if not cert.cid_blob:
            return err_500("missing_cid", "Encrypted file CID is missing.")

        # require ACTIVE on-chain
        v = BlockchainService.verify_certificate(_norm_hash(cert.file_hash)) if cert.file_hash else {}
        if not (_coerce_bool(v.get("exists")) and not _coerce_bool(v.get("revoked"))):
            return err_409("revoked_or_missing", "Certificate is not valid on-chain for viewing.")

        try:
            enc_bytes = _fetch_cid_bytes(cert.cid_blob, timeout=60)
            pdf_bytes = _aes_gcm_decrypt(enc_bytes, cert.enc_key_protected, cert.enc_nonce, cert.enc_tag)
        except subprocess.CalledProcessError as e:
            return err_500("fetch_cid_failed", "Could not fetch encrypted file.", {"output": (e.output or "")[:400]})
        except subprocess.TimeoutExpired:
            return err_500("fetch_cid_timeout", "Timed out fetching encrypted file from storage.")
        except ValueError:
            return err_500("decryption_failed", "Decryption failed. Stored data may be corrupted.")
        except Exception as e:
            return err_500("file_download_failed", "Unexpected error while fetching/decrypting.", {"err": str(e)})

        resp = HttpResponse(pdf_bytes, content_type="application/pdf")
        resp["Content-Disposition"] = f'inline; filename="certificate_{cert.id}.pdf"'
        return resp


# ========================= Employer scope (GLOBAL per your rule) =========================

@extend_schema_view(
    retrieve=extend_schema(
        tags=["5. Employer Certificates"],
        summary="01. Get certificate details (GLOBAL view)",
        operation_id="05_employer_certs_retrieve",
        responses={200: CertificateDetailSerializer, 404: {"description": "Not found"}},
    ),
)
class EmployerCertificatesViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """
    /api/employer/certificates/{id}/
    GLOBAL browse is allowed per business rule.
    """
    permission_classes = [IsAuthenticated]  # you said approval is guaranteed at signup; keep global access
    authentication_classes = [JWTAuthentication]
    parser_classes = [JSONParser]
    serializer_class = CertificateDetailSerializer
    pagination_class = None

    def get_queryset(self):
        return Certificate.objects.select_related("applicant", "institution")

    # detail response + tx info
    def retrieve(self, request, pk=None):
        cert = get_object_or_404(self.get_queryset(), pk=pk)
        data = CertificateDetailSerializer(cert).data
        info = BlockchainService.get_transaction_info(_norm_hash(cert.file_hash)) or {}
        data.update({
            "tx_hash": info.get("revokeTx") or info.get("issuedTx"),
            "block_number": info.get("revokeBlock") or info.get("issuedBlock"),
            "issuedTx": info.get("issuedTx"),
            "issuedBlock": info.get("issuedBlock"),
            "revokeTx": info.get("revokeTx"),
            "revokeBlock": info.get("revokeBlock"),
        })
        return Response(data, status=200)

    @extend_schema(
        tags=["5. Employer Certificates"],
        summary="02. Tx info",
        operation_id="05_employer_certs_tx_info",
        responses={200: {"type": "object"}},
    )
    @action(methods=["get"], detail=True, url_path="tx-info", permission_classes=[IsAuthenticated])
    def tx_info(self, request, pk=None):
        cert = get_object_or_404(self.get_queryset(), pk=pk)
        info = BlockchainService.get_transaction_info(_norm_hash(cert.file_hash)) or {}
        return Response(info, status=200)

    @extend_schema(
        tags=["5. Employer Certificates"],
        summary="03. Download decrypted PDF (inline)",
        operation_id="05_employer_certs_file",
        responses={200: {"content": {"application/pdf": {}}}, 404: {"description": "Not found"}},
    )
    @action(methods=["get"], detail=True, url_path="file", permission_classes=[IsAuthenticated])
    def file(self, request, pk=None):
        cert = get_object_or_404(self.get_queryset(), pk=pk)
        if not cert.cid_blob:
            return err_500("missing_cid", "Encrypted file CID is missing.")

        try:
            enc_bytes = _fetch_cid_bytes(cert.cid_blob, timeout=60)
            pdf_bytes = _aes_gcm_decrypt(enc_bytes, cert.enc_key_protected, cert.enc_nonce, cert.enc_tag)
        except subprocess.CalledProcessError as e:
            return err_500("fetch_cid_failed", "Could not fetch encrypted file.", {"output": (e.output or "")[:400]})
        except subprocess.TimeoutExpired:
            return err_500("fetch_cid_timeout", "Timed out fetching encrypted file from storage.")
        except ValueError:
            return err_500("decryption_failed", "Decryption failed. Stored data may be corrupted.")
        except Exception as e:
            return err_500("file_download_failed", "Unexpected error while fetching/decrypting.", {"err": str(e)})

        resp = HttpResponse(pdf_bytes, content_type="application/pdf")
        resp["Content-Disposition"] = f'inline; filename="certificate_{cert.id}.pdf"'
        return resp


