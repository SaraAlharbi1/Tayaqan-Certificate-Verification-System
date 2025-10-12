# backend/api/certificates/views.py
import os
import sys
import json
import base64
import tempfile
import subprocess
import secrets
from pathlib import Path
import pathlib

from django.shortcuts import get_object_or_404
from django.db import transaction, IntegrityError
from django.db.models import QuerySet
from django.http import HttpResponse

from rest_framework import viewsets, mixins, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from drf_spectacular.utils import (
    extend_schema,
    extend_schema_view,
    OpenApiParameter,
)
from drf_spectacular.openapi import OpenApiTypes

from Crypto.Cipher import AES
from Crypto.Hash import keccak

from .models import Certificate
from .serializers import (
    CertificateListSerializer,
    CertificateDetailSerializer,
    MyCertificateListSerializer,
    MyCertificateDetailSerializer,
)
from api.accounts.models import Institution, Applicant


# ------------------------- helpers -------------------------

def keccak256_hex(b: bytes) -> str:
    k = keccak.new(digest_bits=256)
    k.update(b)
    return "0x" + k.hexdigest()


def aes_gcm_encrypt(data: bytes):
    key = secrets.token_bytes(32)
    nonce = secrets.token_bytes(12)
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    ct, tag = cipher.encrypt_and_digest(data)
    return key, nonce, tag, ct


def _resolve_institution(user) -> Institution:
    return get_object_or_404(Institution, user=user)


def _resolve_applicant(user) -> Applicant:
    return get_object_or_404(Applicant, user=user)


def _api_err(status_code: int, code: str, user_message: str, detail=None):
    return Response(
        {"code": code, "user_message": user_message, "detail": detail or {}},
        status=status_code,
    )


def err_400(code, msg, d=None): return _api_err(status.HTTP_400_BAD_REQUEST, code, msg, d)
def err_403(code, msg, d=None): return _api_err(status.HTTP_403_FORBIDDEN, code, msg, d)
def err_404(code, msg, d=None): return _api_err(status.HTTP_404_NOT_FOUND, code, msg, d)
def err_409(code, msg, d=None): return _api_err(status.HTTP_409_CONFLICT, code, msg, d)
def err_500(code, msg, d=None): return _api_err(status.HTTP_500_INTERNAL_SERVER_ERROR, code, msg, d)


# ========================= Institution scope =========================

@extend_schema_view(
    list=extend_schema(
        tags=["Certificates"],
        summary="List certificates for the current institution",
        parameters=[
            OpenApiParameter(name="status", type=OpenApiTypes.STR, required=False, description="Exact status filter (e.g. ACTIVE or REVOKED)"),
            OpenApiParameter(name="status__in", type=OpenApiTypes.STR, required=False, description="Comma-separated list of statuses (e.g. ACTIVE,REVOKED)"),
            OpenApiParameter(name="search", type=OpenApiTypes.STR, required=False),
            OpenApiParameter(name="ordering", type=OpenApiTypes.STR, required=False),
            OpenApiParameter(name="page", type=OpenApiTypes.INT, required=False),
        ],
        responses={200: CertificateListSerializer(many=True)},
    ),
    retrieve=extend_schema(
        tags=["Certificates"],
        summary="Get certificate details (institution-scoped)",
        responses={200: CertificateDetailSerializer, 404: {"description": "Not found"}},
    ),
)
class InstitutionCertificateViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    filterset_fields = {
        "status": ["exact", "in"],
        "issued_on": ["gte", "lte"],
    }

    search_fields = [
        "display_label",
        "serial_number",
        "applicant__full_name",
        "applicant__national_id_plain",
    ]

    ordering_fields = ["issued_on", "id", "created_at", "serial_number"]
    ordering = ["-issued_on", "-id"]

    def get_queryset(self) -> QuerySet:
        institution = _resolve_institution(self.request.user)
        qs = Certificate.objects.filter(institution=institution).select_related("applicant")
        return qs.order_by(*self.ordering)

    def get_serializer_class(self):
        return CertificateDetailSerializer if self.action == "retrieve" else CertificateListSerializer

    @extend_schema(
        tags=["Certificates"],
        summary="Download (inline) the decrypted PDF",
        responses={200: {"content": {"application/pdf": {}}}, 404: {"description": "Not found"}},
    )
    @action(methods=["get"], detail=True, url_path="file", permission_classes=[IsAuthenticated])
    def file(self, request, pk=None):
        institution = _resolve_institution(self.request.user)
        cert = get_object_or_404(
            Certificate.objects.filter(institution=institution).select_related("applicant"),
            pk=pk,
        )

        try:
            out = subprocess.check_output(
                ["node", "backend_scripts/fetch_cid.js", cert.cid_enc],
                text=True,
                stderr=subprocess.STDOUT,
                timeout=60,
                env=os.environ.copy(),
            )
            data = json.loads(out)
            enc_bytes = base64.b64decode(data["bytes_b64"])
        except subprocess.CalledProcessError as e:
            return err_500("fetch_cid_failed", "Could not fetch encrypted file.", {"output": (e.output or "")[:400]})
        except subprocess.TimeoutExpired:
            return err_500("fetch_cid_timeout", "Timed out fetching encrypted file from storage.")
        except Exception as e:
            return err_500("parse_storage_payload_failed", "Unexpected storage response.", {"err": str(e)})

        key = bytes.fromhex(cert.enc_key_protected)
        nonce = bytes.fromhex(cert.enc_nonce)
        tag = bytes.fromhex(cert.enc_tag)
        cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
        try:
            pdf_bytes = cipher.decrypt_and_verify(enc_bytes, tag)
        except ValueError:
            return err_500("decryption_failed", "Decryption failed. Stored data may be corrupted.")

        resp = HttpResponse(pdf_bytes, content_type="application/pdf")
        resp["Content-Disposition"] = f'inline; filename="certificate_{cert.id}.pdf"'
        return resp

    @extend_schema(
        tags=["Certificates"],
        summary="Issue a certificate (on-chain → encrypt → upload → save)",
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
    @action(methods=["post"], detail=False, url_path="issue", permission_classes=[IsAuthenticated])
    def issue(self, request, *args, **kwargs):
        institution = _resolve_institution(request.user)
        if institution.status != "APPROVED":
            return err_403("institution_not_approved", "Institution is not approved yet.")

        national_id = request.data.get("national_id")
        file_obj = request.FILES.get("file")
        if not file_obj:
            return err_400("missing_file", "Please attach a PDF.")
        if not national_id:
            return err_400("missing_national_id", "National ID is required.")

        applicant = get_object_or_404(Applicant, national_id_plain=national_id)

        # read bytes + hash
        try:
            file_obj.seek(0)
        except Exception:
            pass
        file_bytes = file_obj.read()
        file_hash = keccak256_hex(file_bytes)
        applicant_hash = applicant.national_id_hash

        # duplicate guard
        if Certificate.objects.filter(institution=institution, file_hash=file_hash).exists():
            return err_409(
                "duplicate_file_for_institution",
                "This exact file was already uploaded by your institution.",
                {"file_hash": file_hash},
            )

        # 1) On-chain
        proc = subprocess.run(
            [sys.executable, "backend_scripts/issue_onchain.py", applicant_hash, file_hash],
            text=True, capture_output=True, env={**os.environ, "PYTHONWARNINGS": "ignore"},
        )
        if proc.returncode != 0:
            body = proc.stderr or proc.stdout or ""
            return err_500("onchain_issue_failed", "Blockchain issuance failed.", {"output": body})

        try:
            onchain = json.loads((proc.stdout or "").strip())
            tx_hash = onchain.get("tx")
            block_no = onchain.get("block")
        except Exception:
            return err_500("onchain_response_parse_failed", "Unexpected response from blockchain script.", {"raw": proc.stdout})

        # 2) Encrypt + upload
        key, nonce, tag, enc_bytes = aes_gcm_encrypt(file_bytes)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(enc_bytes)
            tmp_path = tmp.name

        token_file = os.getenv("STORACHA_TOKEN_FILE")
        if token_file and not os.getenv("STORACHA_PROOF"):
            p = pathlib.Path(token_file)
            if p.exists():
                os.environ["STORACHA_PROOF"] = p.read_text(encoding="utf-8").strip()

        try:
            out = subprocess.check_output(
                ["node", "backend_scripts/issue_upload.js", tmp_path],
                text=True, stderr=subprocess.STDOUT, env=os.environ.copy(),
            )
            data = json.loads(out)
            cid_enc = data.get("cid") or (data.get("root") or {}).get("/")
            if not cid_enc:
                raise ValueError(f"Unexpected uploader output: {out}")
        except subprocess.CalledProcessError as e:
            return err_500("storacha_upload_failed", "Encrypted file upload failed.", {"output": e.output})
        except (ValueError, json.JSONDecodeError) as e:
            return err_500("storacha_response_parse_failed", "Unexpected response from uploader.", {"raw": out if 'out' in locals() else str(e)})
        finally:
            try:
                os.remove(tmp_path)
            except Exception:
                pass

        # 3) Persist
        try:
            with transaction.atomic():
                cert = Certificate.objects.create(
                    institution=institution,
                    applicant=applicant,
                    created_by_user=request.user,
                    file_hash=file_hash,
                    cid_enc=cid_enc,
                    enc_nonce=nonce.hex(),
                    enc_tag=tag.hex(),
                    enc_key_protected=key.hex(),
                    display_label=request.data.get("display_label") or None,
                    issued_on=request.data.get("issued_on") or None,
                    serial_number=request.data.get("serial_number") or None,
                    status="ISSUED_ONCHAIN",
                    tx_hash=tx_hash,
                    block_number=block_no,
                )
        except IntegrityError:
            return err_409("certificate_conflict", "A certificate with the same unique fields already exists.", {"file_hash": file_hash})

        return Response(CertificateDetailSerializer(cert).data, status=200)

    @extend_schema(
        tags=["Certificates"],
        summary="Revoke a certificate (on-chain + DB). Idempotent.",
        request=None,
        responses={200: CertificateDetailSerializer, 404: {"description": "Not found"}},
    )
    @action(methods=["post"], detail=True, url_path="revoke", permission_classes=[IsAuthenticated])
    def revoke(self, request, pk=None):
        institution = _resolve_institution(self.request.user)
        cert = get_object_or_404(
            Certificate.objects.filter(institution=institution).select_related("applicant"),
            pk=pk,
        )

        if cert.status == "REVOKED":
            return Response(CertificateDetailSerializer(cert).data, status=200)

        proc = subprocess.run(
            [sys.executable, "backend_scripts/revoke_onchain.py", cert.file_hash],
            text=True, capture_output=True,
            env={**os.environ, "PYTHONWARNINGS": "ignore"},
        )

        if proc.returncode != 0:
            out = (proc.stderr or proc.stdout or "")
            if "NotFound" in out:
                return err_404("onchain_not_found", "Certificate not found on-chain.", {"output": out})
            if "AlreadyRevoked" in out:
                cert.status = "REVOKED"
                cert.save(update_fields=["status", "updated_at"])
                return Response(CertificateDetailSerializer(cert).data, status=200)

            return err_500("onchain_revoke_failed", "Blockchain revoke failed.", {"output": out})

        raw = (proc.stdout or "").strip()
        try:
            onchain = json.loads(raw)
        except Exception:
            return err_500("onchain_response_parse_failed", "Unexpected response from blockchain script.", {"raw": raw})

        cert.revoke_tx_hash = onchain.get("tx")
        cert.revoke_block_number = onchain.get("block")
        cert.status = "REVOKED"
        cert.save(update_fields=["status", "revoke_tx_hash", "revoke_block_number", "updated_at"])
        return Response(CertificateDetailSerializer(cert).data, status=200)


# ========================= Applicant scope =========================

@extend_schema_view(
    list=extend_schema(
        tags=["My Certificates"],
        summary="List certificates owned by the current applicant",
        parameters=[
            OpenApiParameter(name="search", type=OpenApiTypes.STR, required=False),
            OpenApiParameter(name="ordering", type=OpenApiTypes.STR, required=False),
            OpenApiParameter(name="page", type=OpenApiTypes.INT, required=False),
        ],
        responses={200: MyCertificateListSerializer(many=True)},
    ),
    retrieve=extend_schema(
        tags=["My Certificates"],
        summary="Get my certificate details",
        responses={200: MyCertificateDetailSerializer, 404: {"description": "Not found"}},
    ),
)
class MyCertificateViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    filterset_fields = {
        "status": ["exact", "in"],
        "issued_on": ["gte", "lte"],
    }

    search_fields = [
        "display_label",
        "serial_number",
        "status",
        "institution__institution_name",
    ]

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
        return MyCertificateDetailSerializer if self.action == "retrieve" else MyCertificateListSerializer

    @extend_schema(
        tags=["My Certificates"],
        summary="Download my certificate (decrypted PDF, inline)",
        responses={200: {"content": {"application/pdf": {}}}, 404: {"description": "Not found"}},
    )
    @action(methods=["get"], detail=True, url_path="file", permission_classes=[IsAuthenticated])
    def file(self, request, pk=None):
        applicant = _resolve_applicant(self.request.user)
        cert = get_object_or_404(
            Certificate.objects.filter(applicant=applicant),
            pk=pk,
        )

        if not cert.cid_enc:
            return err_500("missing_cid", "Encrypted file CID is missing.")
        for f in ("enc_key_protected", "enc_nonce", "enc_tag"):
            if not getattr(cert, f, None):
                return err_500("missing_crypto_meta", f"Missing crypto meta: {f}")

        try:
            out = subprocess.check_output(
                ["node", "backend_scripts/fetch_cid.js", cert.cid_enc],
                text=True,
                stderr=subprocess.STDOUT,
                timeout=60,
                env=os.environ.copy(),
            )
        except subprocess.CalledProcessError as e:
            return err_500("fetch_cid_failed", "Could not fetch encrypted file.", {"output": (e.output or "")[:400]})
        except subprocess.TimeoutExpired:
            return err_500("fetch_cid_timeout", "Timed out fetching encrypted file from storage.")
        except FileNotFoundError:
            return err_500("node_missing", "Node.js not installed or not in PATH.")

        try:
            data = json.loads(out)
            enc_b64 = data.get("bytes_b64")
            if not enc_b64:
                return err_500("bad_storage_payload", "Storage returned no data.", {"raw": out[:400]})
            enc_bytes = base64.b64decode(enc_b64)
        except Exception as e:
            return err_500("parse_storage_payload_failed", "Unexpected storage response.", {"raw": out[:400], "err": str(e)})

        try:
            key = bytes.fromhex(cert.enc_key_protected)
            nonce = bytes.fromhex(cert.enc_nonce)
            tag = bytes.fromhex(cert.enc_tag)
            cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
            pdf_bytes = cipher.decrypt_and_verify(enc_bytes, tag)
        except ValueError:
            return err_500("decryption_failed", "Decryption failed. Stored data may be corrupted.")
        except Exception as e:
            return err_500("decrypt_error", "Unexpected decrypt error.", {"err": str(e)})

        resp = HttpResponse(pdf_bytes, content_type="application/pdf")
        resp["Content-Disposition"] = f'inline; filename="certificate_{cert.id}.pdf"'
        return resp
