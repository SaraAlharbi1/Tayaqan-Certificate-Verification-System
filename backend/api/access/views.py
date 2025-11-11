# backend/api/access/views.py
"""
Access flows.
- Employer: create/list own requests; verify applicant exists; see shared certs.
- Applicant: list incoming; approve/reject with on-chain check; list candidate certs.
- Employer certificates (shared): fetch only APPROVED shares; decrypt & stream PDF if on-chain ACTIVE.
"""
import os
import sys
import json
import base64
import subprocess
from typing import Dict, List

from django.conf import settings
from django.db import transaction, IntegrityError
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import viewsets, mixins
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import JSONParser
from rest_framework.permissions import IsAuthenticated, BasePermission
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter
from drf_spectacular.openapi import OpenApiTypes

from Crypto.Cipher import AES

from .models import AccessRequest, AccessShare
from .serializers import (
    AccessRequestCreateSerializer,
    AccessRequestSerializer,
    AccessApproveSerializer,
)
from api.certificates.models import Certificate
from api.certificates.serializers import CertificateListSerializer


# ───────────── Helpers ─────────────

def _as_list(res):
    if isinstance(res, str):
        try:
            return json.loads(res)
        except Exception:
            return []
    if isinstance(res, dict):
        return [{"fileHash": k, **(v or {})} for k, v in res.items()]
    return res if isinstance(res, list) else []


def _coerce_bool(x) -> bool:
    if isinstance(x, bool):
        return x
    return str(x).strip().lower() in ("true", "1", "yes")


def _norm_hash(h: str) -> str:
    if not h:
        return ""
    h = h.strip().lower()
    return h if h.startswith("0x") else ("0x" + h)


def _verify_batch_onchain(file_hashes: List[str]) -> List[dict]:
    if not file_hashes:
        return []
    try:
        proc = subprocess.run(
            [sys.executable, "utils/verify_certificates_batch.py", *file_hashes],
            text=True,
            capture_output=True,
            env={**os.environ, "PYTHONWARNINGS": "ignore"},
            timeout=60,
        )
    except subprocess.TimeoutExpired:
        return [{"fileHash": h, "exists": False, "revoked": True, "error": "timeout"} for h in file_hashes]

    raw = proc.stdout or "[]"
    try:
        return json.loads(raw)
    except Exception:
        return [{"fileHash": h, "exists": False, "revoked": True, "error": "bad_json"} for h in file_hashes]


def _verify_one_onchain(file_hash: str) -> dict:
    res = _as_list(_verify_batch_onchain([file_hash]))
    want = _norm_hash(file_hash)
    v = next((o for o in res if _norm_hash(o.get("fileHash") or "") == want), {})
    return {
        "fileHash": v.get("fileHash") or file_hash,
        "exists": _coerce_bool(v.get("exists")),
        "revoked": _coerce_bool(v.get("revoked")),
    }


def _tx_info_onchain(file_hash: str) -> dict:
    try:
        p = subprocess.run(
            [sys.executable, "utils/get_transaction_info.py", file_hash],
            text=True,
            capture_output=True,
            env={**os.environ, "PYTHONWARNINGS": "ignore"},
            timeout=60,
        )
    except subprocess.TimeoutExpired:
        return {"error": "timeout"}
    raw = p.stdout or "{}"
    try:
        return json.loads(raw)
    except Exception:
        return {"error": "bad_json"}


def _fetch_cid_bytes_b64(cid: str, *, timeout=60) -> bytes:
    out = subprocess.check_output(
        ["node", "utils/fetch_cid.js", cid],
        text=True,
        stderr=subprocess.STDOUT,
        timeout=timeout,
        env=os.environ.copy(),
    )
    payload = json.loads(out)
    return base64.b64decode(payload["bytes_b64"])


def _active_map(hashes: List[str]) -> Dict[str, bool]:
    hashes = [h for h in (hashes or []) if h]
    if not hashes:
        return {}
    if len(hashes) == 1:
        v = _verify_one_onchain(hashes[0])
        return {hashes[0].lower(): _coerce_bool(v.get("exists")) and not _coerce_bool(v.get("revoked"))}
    out: Dict[str, bool] = {}
    for o in _as_list(_verify_batch_onchain(hashes)):
        fh = (o.get("fileHash") or "").lower()
        if fh:
            out[fh] = _coerce_bool(o.get("exists")) and not _coerce_bool(o.get("revoked"))
    return out


# ───────────── Email (best-effort) ─────────────

def send_access_request_email(access_request):
    try:
        applicant_email = access_request.applicant.user.email
        if not applicant_email:
            return
        from django.core.mail import send_mail
        from django.template.loader import render_to_string

        ctx = {
            "brand": getattr(settings, "SITE_NAME", "Tayaqan"),
            "name": access_request.applicant.full_name,
            "employer": access_request.employer.company_name or "An employer",
            "request_id": access_request.id,
            "status": access_request.status,
            "review_url": f"{getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')}/applicant/requests/{access_request.id}",
            "support_email": getattr(settings, "SUPPORT_EMAIL", "support@example.com"),
        }
        html = render_to_string("access_request_created.html", ctx)
        send_mail(
            subject=f"{ctx['brand']} - New Access Request",
            message=f"You have a new access request from {ctx['employer']}. Please review it.",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[applicant_email],
            html_message=html,
            fail_silently=True,
        )
    except Exception as e:
        print(f"access email (create) failed: {e}")


def send_status_update_email(access_request, shared_count=0):
    try:
        employer_email = access_request.employer.user.email
        if not employer_email:
            return
        from django.core.mail import send_mail
        from django.template.loader import render_to_string

        label = access_request.status
        ctx = {
            "brand": getattr(settings, "SITE_NAME", "Tayaqan"),
            "employer_name": access_request.employer.full_name or "there",
            "applicant_name": access_request.applicant.full_name,
            "request_id": access_request.id,
            "status_label": label,
            "shared_count": shared_count,
            "review_url": f"{getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')}/employer/requests/{access_request.id}",
            "support_email": getattr(settings, "SUPPORT_EMAIL", "support@example.com"),
        }
        html = render_to_string("status_update.html", ctx)
        subject_text = "Approved" if label == "APPROVED" else "Rejected"
        send_mail(
            subject=f"{ctx['brand']} - Access Request {subject_text}",
            message=f"Your access request has been {label.lower()}.",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[employer_email],
            html_message=html,
            fail_silently=True,
        )
    except Exception as e:
        print(f"access email (status) failed: {e}")


# ───────────── Permissions ─────────────

class IsEmployer(BasePermission):
    def has_permission(self, request, view):
        return bool(getattr(request.user, "employer", None))


class IsApplicant(BasePermission):
    def has_permission(self, request, view):
        return bool(getattr(request.user, "applicant", None))


# ───────────── Employer ViewSet ─────────────

@extend_schema_view(
    list=extend_schema(
        tags=["3. Access"],
        summary="01. Employer: List my access requests",
        operation_id="03_access_employer_requests_list",
        responses={200: AccessRequestSerializer(many=True)},
    ),
    create=extend_schema(
        tags=["3. Access"],
        summary="02. Employer: Create access request",
        operation_id="03_access_employer_requests_create",
        request=AccessRequestCreateSerializer,
        responses={201: AccessRequestSerializer},
    ),
    retrieve=extend_schema(
        tags=["3. Access"],
        summary="03. Employer: Get a request",
        operation_id="03_access_employer_requests_retrieve",
        responses={200: AccessRequestSerializer, 404: {"description": "Not found"}},
    ),
)
class EmployerAccessRequestViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Employer creates/lists/reads own requests."""
    permission_classes = [IsAuthenticated, IsEmployer]
    parser_classes = [JSONParser]
    throttle_classes = [UserRateThrottle]

    def get_queryset(self):
        emp = self.request.user.employer
        return (
            AccessRequest.objects
            .filter(employer=emp)
            .select_related("employer", "applicant")
            .order_by("-created_at")
        )

    def get_serializer_class(self):
        if self.action == "create":
            return AccessRequestCreateSerializer
        if self.action == "list":
            return AccessRequestSerializer
        return AccessRequestSerializer

    def create(self, request, *args, **kwargs):
        try:
            resp = super().create(request, *args, **kwargs)
            access_request_id = resp.data.get("id")
            if access_request_id:
                try:
                    ar = AccessRequest.objects.select_related("employer__user", "applicant__user").get(id=access_request_id)
                    send_access_request_email(ar)
                except AccessRequest.DoesNotExist:
                    pass
            return resp
        except IntegrityError as e:
            s = str(e).lower()
            if "uniq_pending_request" in s or "unique constraint" in s:
                return Response({"code": "duplicate_pending", "user_message": "A pending request already exists for this applicant."}, status=400)
            raise

    @extend_schema(
        tags=["3. Access"],
        summary="04. Employer: Verify applicant by national ID",
        operation_id="03_access_employer_verify_applicant",
        parameters=[OpenApiParameter(name="national_id", location=OpenApiParameter.PATH, type=OpenApiTypes.STR)],
        responses={200: {"type": "object"}, 404: {"description": "Applicant not found"}},
    )
    @action(detail=False, methods=["get"], url_path=r"verify-applicant/(?P<national_id>[0-9]{10})")
    def verify_applicant(self, request, national_id=None):
        from api.accounts.models import Applicant
        exists = Applicant.objects.filter(national_id_plain=national_id).exists()
        return Response({"exists": bool(exists)}, status=(200 if exists else 404))

    @extend_schema(
        tags=["3. Access"],
        summary="05. Employer: List ACTIVE shared certificates for a request",
        operation_id="03_access_employer_request_shared",
        responses={200: {"type": "object"}},
    )
    @action(detail=True, methods=["get"])
    def shared(self, request, pk=None):
        """List ACTIVE shared certs for this APPROVED request (single if 1, else batch)."""
        access_request = self.get_object()
        if access_request.employer != request.user.employer:
            raise PermissionDenied("Not your request.")
        if access_request.status != AccessRequest.Status.APPROVED:
            return Response({"certificates": []})

        shares = (
            AccessShare.objects
            .filter(request=access_request)
            .select_related("certificate__institution", "certificate__applicant")
            .order_by("-certificate__issued_on", "-certificate__id")
        )

        certs = [s.certificate for s in shares]
        hashes = [c.file_hash for c in certs if c.file_hash]
        is_active = _active_map(hashes)  # single vs batch

        out = []
        for c in certs:
            fh = (c.file_hash or "").lower()
            if is_active.get(fh):
                out.append({
                    "id": c.id,
                    "display_label": c.display_label,
                    "serial_number": c.serial_number,
                    "issued_on": c.issued_on,
                    "file_hash": c.file_hash,
                    "institution_name": getattr(c.institution, "institution_name", None),
                    "status": "ACTIVE",
                })

        page = self.paginate_queryset(out)
        data = page if page is not None else out
        return self.get_paginated_response(data) if page is not None else Response({"certificates": data})


# ───────────── Applicant ViewSet ─────────────

@extend_schema_view(
    list=extend_schema(
        tags=["3. Access"],
        summary="06. Applicant: List incoming access requests",
        operation_id="03_access_my_requests_list",
        responses={200: AccessRequestSerializer(many=True)},
    ),
    retrieve=extend_schema(
        tags=["3. Access"],
        summary="07. Applicant: Get a request",
        operation_id="03_access_my_requests_retrieve",
        responses={200: AccessRequestSerializer, 404: {"description": "Not found"}},
    ),
)
class ApplicantAccessRequestViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Applicant manages incoming requests and approvals."""
    permission_classes = [IsAuthenticated, IsApplicant]
    parser_classes = [JSONParser]

    def get_queryset(self):
        app = self.request.user.applicant
        return (
            AccessRequest.objects
            .filter(applicant=app)
            .select_related("employer", "applicant")
            .order_by("-created_at")
        )

    def get_serializer_class(self):
        if self.action == "list":
            return AccessRequestSerializer
        return AccessRequestSerializer

    @extend_schema(
        tags=["3. Access"],
        summary="08. Applicant: Candidate certificates (with live chain status)",
        operation_id="03_access_my_requests_candidate_certificates",
        responses={200: {"type": "object"}},
    )
    @action(detail=True, methods=["get"])
    def candidate_certificates(self, request, pk=None):
        """List applicant certs with live chain status (batch)."""
        access_request = self.get_object()
        qs = (
            Certificate.objects
            .filter(applicant=access_request.applicant)
            .select_related("institution")
            .order_by("-issued_on", "-id")
        )
        page = self.paginate_queryset(qs)
        rows = page if page is not None else qs

        hashes = [c.file_hash for c in rows if c.file_hash]
        ver = _as_list(_verify_batch_onchain(hashes))

        vmap: Dict[str, dict] = {}
        for o in ver:
            fh = (o.get("fileHash") or "").lower()
            if fh:
                vmap[fh] = o

        serial = CertificateListSerializer(rows, many=True).data
        for item in serial:
            fh = (item.get("file_hash") or "").lower()
            v = vmap.get(fh, {})
            exists = _coerce_bool(v.get("exists"))
            revoked = _coerce_bool(v.get("revoked"))
            item["status"] = "ACTIVE" if (exists and not revoked) else ("REVOKED" if revoked else "INVALID")

        if page is not None:
            return self.get_paginated_response(serial)
        return Response({"certificates": serial})

    @extend_schema(
        tags=["3. Access"],
        summary="09. Applicant: Approve request (share only ACTIVE certs)",
        operation_id="03_access_my_requests_approve",
        request=AccessApproveSerializer,
        responses={200: {"type": "object"}, 400: {"description": "No valid certificates"}},
    )
    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Approve with selected cert IDs; single if 1 hash else batch; share only ACTIVE."""
        ser = AccessApproveSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ids = list(dict.fromkeys(ser.validated_data["certificate_ids"]))

        with transaction.atomic():
            ar = (
                AccessRequest.objects
                .select_for_update()
                .select_related("applicant", "employer")
                .get(pk=pk)
            )
            if ar.status != AccessRequest.Status.PENDING:
                return Response({"code": "not_pending", "user_message": "Request is not pending."}, status=400)

            owned = list(Certificate.objects.filter(id__in=ids, applicant=ar.applicant)
                         .values_list("id", "file_hash"))
            if len(owned) != len(ids):
                return Response({"code": "invalid_certificates", "user_message": "One or more certificate IDs are invalid."}, status=400)

            hashes = [fh for (_, fh) in owned if fh]
            res_list = ([_verify_one_onchain(hashes[0])] if len(hashes) == 1 else _as_list(_verify_batch_onchain(hashes)))

            vmap: Dict[str, dict] = {}
            for o in res_list:
                fh = (o.get("fileHash") or "").lower()
                if fh:
                    vmap[fh] = o

            valid_ids, skipped = [], []
            for cid, fh in owned:
                v = vmap.get((fh or "").lower(), {})
                if _coerce_bool(v.get("exists")) and not _coerce_bool(v.get("revoked")):
                    valid_ids.append(cid)
                else:
                    skipped.append({"id": cid, "reason": "not_issued_or_revoked"})

            if not valid_ids:
                return Response(
                    {"code": "no_valid_certificates", "user_message": "None of the selected certificates are valid on-chain.", "skipped": skipped},
                    status=400,
                )

            AccessShare.objects.bulk_create(
                [AccessShare(request=ar, certificate_id=i) for i in valid_ids],
                ignore_conflicts=True,
            )
            ar.status = AccessRequest.Status.APPROVED
            ar.decided_at = timezone.now()
            ar.save(update_fields=["status", "decided_at"])

        send_status_update_email(ar, shared_count=len(valid_ids))
        return Response({"status": "approved", "certificates_shared": len(valid_ids), "created_ids": valid_ids, "skipped": skipped})

    @extend_schema(
        tags=["3. Access"],
        summary="10. Applicant: Reject request",
        operation_id="03_access_my_requests_reject",
        responses={200: AccessRequestSerializer},
    )
    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        with transaction.atomic():
            ar = AccessRequest.objects.select_for_update().get(pk=pk)
            if ar.status != AccessRequest.Status.PENDING:
                return Response({"code": "not_pending", "user_message": "Request is not pending."}, status=400)
            ar.status = AccessRequest.Status.REJECTED
            ar.decided_at = timezone.now()
            ar.save(update_fields=["status", "decided_at"])
        send_status_update_email(ar)
        return Response(AccessRequestSerializer(ar).data)


# ───────────── Employer Certificate Access (shared) ─────────────

@extend_schema_view(
    list=extend_schema(
        tags=["3. Access"],
        summary="11. Employer: List shared certificates (APPROVED only)",
        operation_id="03_access_employer_shared_certs_list",
        responses={200: CertificateListSerializer(many=True)},
    ),
    retrieve=extend_schema(
        tags=["3. Access"],
        summary="12. Employer: Get a shared certificate",
        operation_id="03_access_employer_shared_certs_retrieve",
        responses={200: {"type": "object"}, 404: {"description": "Not found"}},
    ),
)
class EmployerCertificateViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Employer sees only APPROVED shares."""
    permission_classes = [IsAuthenticated, IsEmployer]
    parser_classes = [JSONParser]
    throttle_classes = [UserRateThrottle]

    def get_queryset(self):
        emp = self.request.user.employer
        if getattr(emp, "status", "PENDING") != "APPROVED":
            return Certificate.objects.none()
        return (
            Certificate.objects
            .filter(
                access_shares__request__employer=emp,
                access_shares__request__status=AccessRequest.Status.APPROVED,
            )
            .select_related("institution", "applicant")
            .distinct()
            .order_by("-issued_on", "-id")
        )

    def retrieve(self, request, pk=None):
        cert = get_object_or_404(self.get_queryset(), pk=pk)

        v = _verify_one_onchain(cert.file_hash)
        if not v.get("exists"):
            return Response({"code": "not_verified", "user_message": "Certificate not found on blockchain."}, status=404)

        tx = _tx_info_onchain(cert.file_hash)
        status_txt = "REVOKED" if v.get("revoked") else "ACTIVE"
        http = 410 if status_txt == "REVOKED" else 200

        return Response(
            {
                "id": cert.id,
                "title": cert.display_label,
                "issuerName": getattr(cert.institution, "institution_name", None),
                "issueDate": cert.issued_on,
                "serial": cert.serial_number,
                "status": status_txt,
                "issuedTx": tx.get("issuedTx"),
                "issuedBlock": tx.get("issuedBlock"),
                "revokeTx": tx.get("revokeTx"),
                "revokeBlock": tx.get("revokeBlock"),
            },
            status=http,
        )

    @extend_schema(
        tags=["3. Access"],
        summary="13. Employer: Download shared certificate PDF (inline)",
        operation_id="03_access_employer_shared_certs_file",
        responses={200: {"content": {"application/pdf": {}}}, 404: {"description": "Not found"}, 410: {"description": "Revoked"}},
    )
    @action(detail=True, methods=["get"])
    def file(self, request, pk=None):
        """
        Stream PDF if:
          - certificate is shared to this employer via APPROVED request
          - on-chain status is ACTIVE
        """
        cert = get_object_or_404(self.get_queryset(), pk=pk)

        v = _verify_one_onchain(cert.file_hash)
        if not v.get("exists"):
            return HttpResponse("Certificate not found on blockchain", status=404)
        if v.get("revoked"):
            return HttpResponse("Certificate has been revoked", status=410)
        if not cert.cid_enc:
            return HttpResponse("Missing encrypted file.", status=500)

        try:
            enc_bytes = _fetch_cid_bytes_b64(cert.cid_enc, timeout=60)
        except subprocess.CalledProcessError as e:
            return HttpResponse(f"Fetch failed: {(e.output or '')[:400]}", status=500)
        except Exception as e:
            return HttpResponse(f"Fetch error: {e}", status=500)

        try:
            # envelope: JSON (nonce/tag/ct) under server master key, else raw hex (legacy)
            ek = None
            try:
                ek = json.loads(cert.enc_key_protected) if cert.enc_key_protected and cert.enc_key_protected.strip().startswith("{") else None
            except Exception:
                ek = None

            if ek:
                master_hex = getattr(settings, "FILE_ENC_KEY_HEX", None)
                if not master_hex:
                    return HttpResponse("Server key missing", status=500)
                master = bytes.fromhex(master_hex)
                g1 = AES.new(master, AES.MODE_GCM, nonce=bytes.fromhex(ek["nonce"]))
                data_key = g1.decrypt_and_verify(bytes.fromhex(ek["ct"]), bytes.fromhex(ek["tag"]))
            else:
                data_key = bytes.fromhex(cert.enc_key_protected)

            g2 = AES.new(data_key, AES.MODE_GCM, nonce=bytes.fromhex(cert.enc_nonce))
            pdf = g2.decrypt_and_verify(enc_bytes, bytes.fromhex(cert.enc_tag))

            resp = HttpResponse(pdf, content_type="application/pdf")
            filename = (cert.display_label or f"certificate_{cert.id}").replace('"', "")
            resp["Content-Disposition"] = f'inline; filename="{filename}.pdf"'
            return resp

        except ValueError:
            return HttpResponse("Decryption failed: corrupted data or bad key.", status=500)
        except Exception as e:
            return HttpResponse(f"Decryption error: {e}", status=500)

