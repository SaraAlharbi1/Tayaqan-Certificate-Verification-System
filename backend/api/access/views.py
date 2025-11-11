# backend/api/access/views.py

import os
import sys
import json
import base64
import subprocess
from datetime import datetime

from django.utils import timezone
from django.db import transaction, IntegrityError
from django.http import HttpResponse
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings
from django.shortcuts import get_object_or_404

from rest_framework import viewsets, mixins
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, BasePermission
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from Crypto.Cipher import AES

from .models import AccessRequest, AccessShare
from .serializers import (
    AccessRequestCreateSerializer,
    EmployerAccessRequestListItemSerializer,
    ApplicantAccessRequestListItemSerializer,
    AccessRequestDetailSerializer,
    AccessApproveSerializer,
)
from api.certificates.models import Certificate
from api.certificates.serializers import MyCertificateListSerializer


# ───────────────── helpers ─────────────────
def _as_list(res):
    """JSON string → parse. Dict map → list[{fileHash,...}]. List → as-is. Else → []."""
    if isinstance(res, str):
        try:
            return json.loads(res)
        except Exception:
            return []
    return (
        [{"fileHash": k, **(v or {})} for k, v in res.items()]
        if isinstance(res, dict)
        else (res if isinstance(res, list) else [])
    )


def _coerce_bool(x):
    if isinstance(x, bool):
        return x
    return str(x).strip().lower() in ("true", "1", "yes")


def _norm_hash(h: str) -> str:
    if not h:
        return ""
    h = h.strip().lower()
    return h if h.startswith("0x") else ("0x" + h)


def _verify_batch_onchain(file_hashes: list[str]) -> list[dict]:
    """
    Use the same runner as /api/my/certificates/verify-batch to avoid discrepancies.
    Returns a LIST of objects: [{fileHash, exists, revoked, ...}]
    """
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
    """Single verify via batch path to ensure identical logic."""
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


# ================= Email Helpers =================
def send_access_request_email(access_request):
    try:
        applicant_email = access_request.applicant.user.email
        if not applicant_email:
            return
        context = {
            "brand": getattr(settings, "SITE_NAME", "Tayaqan"),
            "name": access_request.applicant.full_name,
            "employer": access_request.employer.company_name or "An employer",
            "request_id": access_request.id,
            "status": access_request.status,
            "review_url": f"{getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')}/applicant/requests/{access_request.id}",
            "support_email": getattr(settings, "SUPPORT_EMAIL", "support@example.com"),
        }
        html_message = render_to_string("access_request_created.html", context)
        send_mail(
            subject=f"{context['brand']} - New Access Request",
            message=f"You have a new access request from {context['employer']}. Please review it.",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[applicant_email],
            html_message=html_message,
            fail_silently=True,
        )
    except Exception as e:
        print(f"Failed to send access request email: {e}")


def send_status_update_email(access_request, shared_count=0):
    try:
        employer_email = access_request.employer.user.email
        if not employer_email:
            return
        status_label = access_request.status
        context = {
            "brand": getattr(settings, "SITE_NAME", "Tayaqan"),
            "employer_name": access_request.employer.full_name or "there",
            "applicant_name": access_request.applicant.full_name,
            "request_id": access_request.id,
            "status_label": status_label,
            "shared_count": shared_count,
            "review_url": f"{getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')}/employer/requests/{access_request.id}",
            "support_email": getattr(settings, "SUPPORT_EMAIL", "support@example.com"),
        }
        html_message = render_to_string("status_update.html", context)
        subject_text = "Approved" if status_label == "APPROVED" else "Declined"
        send_mail(
            subject=f"{context['brand']} - Access Request {subject_text}",
            message=f"Your access request has been {status_label.lower()}.",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[employer_email],
            html_message=html_message,
            fail_silently=True,
        )
    except Exception as e:
        print(f"Failed to send status update email: {e}")


# ================= Permissions =================
class IsEmployer(BasePermission):
    def has_permission(self, request, view):
        return bool(getattr(request.user, "employer", None))


class IsApplicant(BasePermission):
    def has_permission(self, request, view):
        return bool(getattr(request.user, "applicant", None))


# ================= Employer ViewSet =================
class EmployerAccessRequestViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated, IsEmployer]

    def get_queryset(self):
        return (
            AccessRequest.objects.filter(employer=self.request.user.employer)
            .select_related("employer", "applicant")
            .order_by("-created_at")
        )

    def get_serializer_class(self):
        if self.action == "create":
            return AccessRequestCreateSerializer
        if self.action == "list":
            return EmployerAccessRequestListItemSerializer
        return AccessRequestDetailSerializer

    def create(self, request, *args, **kwargs):
        try:
            response = super().create(request, *args, **kwargs)
            access_request_id = response.data.get("id")
            if access_request_id:
                try:
                    access_request = AccessRequest.objects.select_related(
                        "employer__user", "applicant__user"
                    ).get(id=access_request_id)
                    send_access_request_email(access_request)
                except AccessRequest.DoesNotExist:
                    pass
            return response
        except IntegrityError as e:
            error_str = str(e).lower()
            if "uniq_pending_request" in error_str or "unique constraint" in error_str:
                return Response(
                    {
                        "code": "duplicate_pending",
                        "user_message": "A pending request already exists for this applicant.",
                    },
                    status=400,
                )
            raise

    @action(detail=False, methods=["get"], url_path="verify-applicant/(?P<national_id>[0-9]{10})")
    def verify_applicant(self, request, national_id=None):
        from api.accounts.models import Applicant

        try:
            applicant = Applicant.objects.get(national_id_plain=national_id)
            return Response(
                {
                    "name": applicant.full_name,
                    "email": getattr(applicant.user, "email", None)
                    if hasattr(applicant, "user")
                    else None,
                }
            )
        except Applicant.DoesNotExist:
            return Response(
                {
                    "code": "applicant_not_found",
                    "user_message": "No applicant found with this National ID.",
                },
                status=404,
            )

    @action(detail=True, methods=["get"])
    def shared(self, request, pk=None):
        """List ACTIVE on-chain shared certificates for this approved request (batch verify)."""
        access_request = self.get_object()
        employer = request.user.employer
        if access_request.employer != employer:
            raise PermissionDenied("Not your request.")
        if access_request.status != AccessRequest.Status.APPROVED:
            return Response({"certificates": []})

        shares = (
            AccessShare.objects.filter(request=access_request)
            .select_related("certificate__institution", "certificate__applicant")
            .order_by("-certificate__issued_on")
        )
        if not shares:
            return Response({"certificates": []})

        certs = [s.certificate for s in shares]
        file_hashes = [c.file_hash for c in certs if c.file_hash]

        res = _verify_batch_onchain(file_hashes)
        res = _as_list(res)

        # dual-key map (exact + lowercase)
        ver_map = {}
        for o in res:
            fh = o.get("fileHash")
            if not fh:
                continue
            ver_map[fh] = o
            ver_map[fh.lower()] = o

        out = []
        for c in certs:
            fh = c.file_hash or ""
            v = ver_map.get(fh) or ver_map.get(fh.lower())
            exists = _coerce_bool(v.get("exists")) if v else False
            revoked = _coerce_bool(v.get("revoked")) if v else True
            if not exists or revoked:
                continue  # only ACTIVE to employer
            out.append(
                {
                    "id": c.id,
                    "display_label": c.display_label,
                    "serial_number": c.serial_number,
                    "issued_on": c.issued_on,
                    "file_hash": c.file_hash,
                    "institution_name": getattr(c.institution, "institution_name", None),
                    "status": "ACTIVE",
                }
            )

        page = self.paginate_queryset(out)
        data = page if page is not None else out
        return self.get_paginated_response(data) if page is not None else Response({"certificates": data})


# ================= Applicant ViewSet =================
class ApplicantAccessRequestViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    permission_classes = [IsAuthenticated, IsApplicant]

    def get_queryset(self):
        return (
            AccessRequest.objects.filter(applicant=self.request.user.applicant)
            .select_related("employer", "applicant")
            .order_by("-created_at")
        )

    def get_serializer_class(self):
        if self.action == "list":
            return ApplicantAccessRequestListItemSerializer
        return AccessRequestDetailSerializer

    @action(detail=True, methods=["get"])
    def candidate_certificates(self, request, pk=None):
        """Applicant sees their certificates with on-chain status (batch verify)."""
        access_request = self.get_object()
        qs = (
            Certificate.objects.filter(applicant=access_request.applicant)
            .select_related("institution")
            .order_by("-issued_on", "-id")
        )
        page = self.paginate_queryset(qs)
        rows = page if page is not None else qs

        hashes = [c.file_hash for c in rows if c.file_hash]
        res = _verify_batch_onchain(hashes)
        res = _as_list(res)

        # dual-key map
        ver_map = {}
        for o in res:
            fh = o.get("fileHash")
            if not fh:
                continue
            ver_map[fh] = o
            ver_map[fh.lower()] = o

        serial = MyCertificateListSerializer(rows, many=True).data
        for item in serial:
            fh = item.get("file_hash") or ""
            v = ver_map.get(fh) or ver_map.get(fh.lower()) or {}
            exists = _coerce_bool(v.get("exists"))
            revoked = _coerce_bool(v.get("revoked"))
            item["status"] = "ACTIVE" if (exists and not revoked) else ("REVOKED" if revoked else "INVALID")

        if page is not None:
            return self.get_paginated_response(serial)
        return Response({"certificates": serial})

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """
        Verify shared certs:
          - if exactly one certificate → single verify
          - else → batch verify
        Share only ACTIVE (exists && !revoked).
        """
        access_request = self.get_object()
        if access_request.status != AccessRequest.Status.PENDING:
            return Response(
                {"code": "not_pending", "user_message": "Request is not pending."}, status=400
            )

        ser = AccessApproveSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ids = list(dict.fromkeys(ser.validated_data["certificate_ids"]))

        owned = list(
            Certificate.objects.filter(id__in=ids, applicant=access_request.applicant)
        )
        if len(owned) != len(ids):
            return Response(
                {
                    "code": "invalid_certificates",
                    "user_message": "One or more certificate IDs are invalid or not owned by you.",
                },
                status=400,
            )

        hashes = [c.file_hash for c in owned if c.file_hash]

        # ── conditional verify: single vs batch
        if len(hashes) == 1:
            one = _verify_one_onchain(hashes[0])
            res_list = [one]
        else:
            res_list = _as_list(_verify_batch_onchain(hashes))

        # dual-key map
        ver_map = {}
        for o in res_list:
            fh = o.get("fileHash")
            if not fh:
                continue
            ver_map[fh] = o
            ver_map[fh.lower()] = o

        valid_ids, skipped = [], []
        for c in owned:
            fh = c.file_hash or ""
            v = ver_map.get(fh) or ver_map.get(fh.lower()) or {}
            exists = _coerce_bool(v.get("exists"))
            revoked = _coerce_bool(v.get("revoked"))
            if exists and not revoked:
                valid_ids.append(c.id)
            else:
                skipped.append({"id": c.id, "reason": "not_issued_or_revoked"})

        if not valid_ids:
            return Response(
                {
                    "code": "no_valid_certificates",
                    "user_message": "None of the selected certificates are valid on-chain.",
                    "skipped": skipped,
                },
                status=400,
            )

        with transaction.atomic():
            AccessShare.objects.bulk_create(
                [AccessShare(request=access_request, certificate_id=i) for i in valid_ids],
                ignore_conflicts=True,
            )
            access_request.status = AccessRequest.Status.APPROVED
            access_request.decided_at = timezone.now()
            access_request.save(update_fields=["status", "decided_at"])

        access_request.refresh_from_db()
        send_status_update_email(access_request, shared_count=len(valid_ids))
        return Response(
            {
                "status": "approved",
                "certificates_shared": len(valid_ids),
                "created_ids": valid_ids,
                "skipped": skipped,
            }
        )

    @action(detail=True, methods=["post"])
    def decline(self, request, pk=None):
        access_request = self.get_object()
        if access_request.status != AccessRequest.Status.PENDING:
            return Response(
                {"code": "not_pending", "user_message": "Request is not pending."}, status=400
            )
        access_request.status = AccessRequest.Status.DECLINED
        access_request.decided_at = timezone.now()
        access_request.save(update_fields=["status", "decided_at"])
        send_status_update_email(access_request)
        return Response(AccessRequestDetailSerializer(access_request).data)


# ================= Employer Certificate Access =================
class EmployerCertificateViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated, IsEmployer]

    def _must_have_access(self, employer, cert):
        has_access = AccessShare.objects.filter(
            request__employer=employer,
            request__status=AccessRequest.Status.APPROVED,
            certificate=cert,
        ).exists()
        if not has_access:
            raise PermissionDenied("You don't have access to this certificate.")

    def retrieve(self, request, pk=None):
        """Employer reads a single shared certificate with chain status + tx info (single verify)."""
        employer = request.user.employer
        certificate = get_object_or_404(
            Certificate.objects.select_related("institution", "applicant"), pk=pk
        )
        self._must_have_access(employer, certificate)

        v = _verify_one_onchain(certificate.file_hash)
        if not v.get("exists"):
            return Response(
                {"code": "not_verified", "user_message": "Certificate not found on blockchain."},
                status=404,
            )

        tx = _tx_info_onchain(certificate.file_hash)

        if v.get("revoked"):
            return Response(
                {
                    "id": certificate.id,
                    "title": certificate.display_label,
                    "issuerName": certificate.institution.institution_name,
                    "issueDate": certificate.issued_on,
                    "serial": certificate.serial_number,
                    "status": "REVOKED",
                    "issuedTx": tx.get("issuedTx"),
                    "issuedBlock": tx.get("issuedBlock"),
                    "revokeTx": tx.get("revokeTx"),
                    "revokeBlock": tx.get("revokeBlock"),
                },
                status=410,
            )

        return Response(
            {
                "id": certificate.id,
                "title": certificate.display_label,
                "issuerName": certificate.institution.institution_name,
                "issueDate": certificate.issued_on,
                "serial": certificate.serial_number,
                "status": "ACTIVE",
                "issuedTx": tx.get("issuedTx"),
                "issuedBlock": tx.get("issuedBlock"),
                "revokeTx": tx.get("revokeTx"),
                "revokeBlock": tx.get("revokeBlock"),
            }
        )

    @action(detail=True, methods=["get"])
    def file(self, request, pk=None):
        """
        Decrypt & stream PDF to employer if:
          1) Share exists and request APPROVED
          2) On-chain verify is ACTIVE (exists && !revoked) via single verify
        """
        employer = request.user.employer
        certificate = get_object_or_404(Certificate, pk=pk)
        self._must_have_access(employer, certificate)

        v = _verify_one_onchain(certificate.file_hash)
        if not v.get("exists"):
            return HttpResponse("Certificate not found on blockchain", status=404)
        if v.get("revoked"):
            return HttpResponse("Certificate has been revoked", status=410)

        try:
            out = subprocess.check_output(
                ["node", "utils/fetch_cid.js", certificate.cid_enc],
                text=True,
                stderr=subprocess.STDOUT,
                timeout=60,
                env=os.environ.copy(),
            )
            payload = json.loads(out)
            ciphertext = base64.b64decode(payload["bytes_b64"])
        except Exception as e:
            return HttpResponse(f"Fetch error: {e}", status=500)

        try:
            master_hex = getattr(settings, "FILE_ENC_KEY_HEX", None)
            if not master_hex:
                return HttpResponse("Server key missing", status=500)
            master = bytes.fromhex(master_hex)
            data_key = bytes(a ^ b for a, b in zip(bytes.fromhex(certificate.enc_key_protected), master))

            cipher = AES.new(key=data_key, mode=AES.MODE_GCM, nonce=bytes.fromhex(certificate.enc_nonce))
            plain = cipher.decrypt_and_verify(ciphertext, bytes.fromhex(certificate.enc_tag))

            resp = HttpResponse(plain, content_type="application/pdf")
            filename = (certificate.display_label or f"certificate_{certificate.id}").replace('"', "")
            resp["Content-Disposition"] = f'inline; filename="{filename}.pdf"'
            return resp
        except Exception as e:
            return HttpResponse(f"Decryption error: {e}", status=500)
