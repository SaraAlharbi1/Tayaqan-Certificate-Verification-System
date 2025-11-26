# backend/api/access/views.py
"""Access control views with blockchain verification."""

import logging
from datetime import timedelta
from django.utils import timezone
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from web3 import Web3
from django.shortcuts import redirect

from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter
from drf_spectacular.openapi import OpenApiTypes

from .models import AccessRequest, AccessShare
from .serializers import (
    AccessRequestSerializer,
    AccessRequestCreateSerializer,
    AccessApproveSerializer,
    AccessShareSerializer,
)
from api.certificates.models import Certificate
from helpers.blockchain_service import create_blockchain_service

# ✅ Import events for email notifications
from .events import (
    access_request_created,
    access_request_approved,
    access_request_rejected,
)

logger = logging.getLogger(__name__)


def _get_employer_id_hash(employer) -> str:
    """Generate employer ID hash for blockchain verification."""
    return Web3.solidity_keccak(['string'], [employer.official_email]).hex()


@extend_schema_view(
    list=extend_schema(
        tags=["Applicant Access"],
        summary="List Access Requests",
        description="List all access requests received by the applicant.",
    ),
    retrieve=extend_schema(
        tags=["Applicant Access"],
        summary="Get Access Request Details",
        description="Get details of a specific access request.",
    ),
    approve=extend_schema(
        tags=["Applicant Access"],
        summary="Approve Access Request",
        description="Approve request and share certificates with blockchain sync.",
        request=AccessApproveSerializer,
    ),
    reject=extend_schema(
        tags=["Applicant Access"],
        summary="Reject Access Request",
        description="Reject an access request from employer.",
    ),
    candidate_certificates=extend_schema(
        tags=["Applicant Access"],
        summary="List Shareable Certificates",
        description="Get blockchain-verified certificates available for sharing.",
    ),
    shared_certificates=extend_schema(
        tags=["Applicant Access"],
        summary="List Shared Certificates",
        description="Get certificates already shared for this request.",
    ),
    revoke_access=extend_schema(
        tags=["Applicant Access"],
        summary="Revoke Certificate Access",
        description="Revoke employer access to specific certificates with blockchain sync.",
    ),
)
class ApplicantAccessRequestViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Applicant views and manages incoming access requests.
    
    Endpoints:
    - GET /api/access/my/requests/ - List all requests
    - GET /api/access/my/requests/{id}/ - Get specific request
    - POST /api/access/my/requests/{id}/approve/ - Approve request with blockchain sync
    - POST /api/access/my/requests/{id}/reject/ - Reject request
    - GET /api/access/my/requests/{id}/candidate_certificates/ - List shareable certificates
    - GET /api/access/my/requests/{id}/shared_certificates/ - List already shared certificates
    - POST /api/access/my/requests/{id}/revoke_access/ - Revoke shared certificates
    """
    
    serializer_class = AccessRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Return access requests for the current applicant."""
        user = self.request.user
        
        try:
            applicant = user.applicant
        except AttributeError:
            return AccessRequest.objects.none()
        
        return AccessRequest.objects.filter(
            applicant=applicant
        ).select_related(
            'employer__user',
            'applicant__user'
        ).prefetch_related(
            'shares__certificate'
        ).order_by('-created_at')

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def approve(self, request, pk=None):
        """
        Applicant approves request and syncs to blockchain using admin wallet.
        
        POST /api/access/my/requests/{id}/approve/
        Body: {
            "certificate_ids": [1, 2, 3],
            "expiry_days": 365
        }
        
        Process:
        1. Validate request is PENDING
        2. ✅ VERIFY certificates exist on blockchain
        3. Approve request in database
        4. Create AccessShare records
        5. Sync to blockchain (signed by admin wallet)
        6. ✅ Send email notification
        7. Return success with blockchain sync status
        """
        req_obj = self.get_object()

        # Validation
        if req_obj.status != AccessRequest.Status.PENDING:
            return Response(
                {
                    "error": "Request is not pending",
                    "current_status": req_obj.status
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Parse and validate input
        serializer = AccessApproveSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        certificate_ids = serializer.validated_data["certificate_ids"]
        expiry_days = serializer.validated_data.get("expiry_days", 365)

        # ✅ VERIFY CERTIFICATES EXIST ON BLOCKCHAIN BEFORE SHARING
        certificates = Certificate.objects.filter(
            id__in=certificate_ids,
            applicant=req_obj.applicant
        ).select_related('institution')
        
        blockchain_verified_certs = []
        skipped_certs = []
        
        for cert in certificates:
            # Check if certificate exists on blockchain
            if self._verify_certificate_on_blockchain(cert):
                blockchain_verified_certs.append(cert)
            else:
                skipped_certs.append({
                    "id": cert.id,
                    "title": cert.display_label,
                    "reason": "Certificate not found on blockchain"
                })
                logger.warning(f"Skipping cert {cert.id}: not on blockchain")
        
        if not blockchain_verified_certs:
            return Response(
                {
                    "error": "None of the selected certificates exist on blockchain",
                    "skipped": skipped_certs
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Approve the request
        req_obj.approve()
        req_obj.save()

        # ✅ Emit event to send approval email
        access_request_approved(req_obj)

        shares_created = 0
        blockchain_synced = 0
        blockchain_errors = []
        
        # Get employer ID hash for blockchain
        employer_id_hash = _get_employer_id_hash(req_obj.employer)
        
        # Calculate expiry date
        expiry_date_dt = None
        expiry_timestamp = 0
        
        if expiry_days > 0:
            expiry_date_dt = timezone.now() + timedelta(days=expiry_days)
            expiry_timestamp = int(expiry_date_dt.timestamp())
        
        # Create shares and sync to blockchain (only for blockchain-verified certs)
        for cert in blockchain_verified_certs:
            try:
                # Create AccessShare in database
                share = AccessShare.objects.create(
                    request=req_obj,
                    certificate=cert,
                    expiry_date=expiry_date_dt,
                    blockchain_synced=False,
                )
                shares_created += 1
                
                # Sync to blockchain using admin wallet
                try:
                    blockchain_service = create_blockchain_service(
                        contract_address=cert.institution.contract_address,
                        use_admin_wallet=True  # Use admin wallet to sign
                    )
                    
                    result = blockchain_service.add_employer_access(
                        file_hash=cert.file_hash,
                        employer_id_hash=employer_id_hash,
                        expiry_timestamp=expiry_timestamp
                    )
                    
                    if result.get("success"):
                        share.blockchain_synced = True
                        share.blockchain_tx_hash = result.get("tx_hash")
                        share.save()
                        blockchain_synced += 1
                        logger.info(
                            f"✓ Blockchain synced for cert {cert.id}: {result.get('tx_hash')}"
                        )
                    else:
                        blockchain_errors.append({
                            "certificate_id": cert.id,
                            "certificate_name": cert.display_label,
                            "error": result.get("error", "Unknown error")
                        })
                        logger.error(
                            f"✗ Blockchain sync failed for cert {cert.id}: {result.get('error')}"
                        )
                        
                except Exception as e:
                    blockchain_errors.append({
                        "certificate_id": cert.id,
                        "certificate_name": cert.display_label,
                        "error": str(e)
                    })
                    logger.error(
                        f"✗ Exception during blockchain sync for cert {cert.id}: {e}",
                        exc_info=True
                    )
                
            except Exception as e:
                logger.error(f"Error creating share for cert {cert.id}: {e}", exc_info=True)

        # Build response
        response_data = {
            "message": f"Request approved! {shares_created} certificate(s) shared.",
            "shares_created": shares_created,
            "blockchain_synced": blockchain_synced,
        }
        
        if blockchain_errors:
            response_data["blockchain_errors"] = blockchain_errors
            if blockchain_synced < shares_created:
                response_data["warning"] = (
                    f"Only {blockchain_synced} of {shares_created} certificates synced to blockchain. "
                    f"{len(blockchain_errors)} failed."
                )
        
        if skipped_certs:
            response_data["skipped_certificates"] = skipped_certs

        return Response(response_data, status=status.HTTP_200_OK)

    def _verify_certificate_on_blockchain(self, certificate):
        """
        Check if certificate exists on blockchain.
        Returns True only if certificate is registered on blockchain.
        """
        try:
            contract_address = certificate.institution.contract_address
            if not contract_address:
                logger.warning(f"No contract address for institution {certificate.institution.id}")
                return False

            blockchain_service = create_blockchain_service(
                contract_address=contract_address,
                use_admin_wallet=False
            )

            result = blockchain_service.verify_certificate(certificate.file_hash)
            
            # Certificate must exist and not be revoked
            if result.get("exists") and not result.get("is_revoked"):
                return True
            
            return False

        except Exception as e:
            logger.error(f"Blockchain verification failed for cert {certificate.id}: {e}")
            return False

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def reject(self, request, pk=None):
        """
        Applicant rejects an access request.
        
        POST /api/access/my/requests/{id}/reject/
        """
        req_obj = self.get_object()

        if req_obj.status != AccessRequest.Status.PENDING:
            return Response(
                {"error": "Request is not pending"},
                status=status.HTTP_400_BAD_REQUEST
            )

        req_obj.reject()
        req_obj.save()

        # ✅ Emit event to send rejection email
        access_request_rejected(req_obj)

        return Response(
            {"message": "Request rejected successfully"},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=["get"], permission_classes=[IsAuthenticated])
    def candidate_certificates(self, request, pk=None):
        """
        Get list of certificates that can be shared for this request.
        
        GET /api/access/my/requests/{id}/candidate_certificates/
        
        ✅ FIXED: Only shows blockchain-verified certificates
        """
        req_obj = self.get_object()
        
        certificates = Certificate.objects.filter(
            applicant=req_obj.applicant,
            revoked_at__isnull=True
        ).select_related('institution').order_by('-issued_on')
        
        # ✅ Only include blockchain-verified certificates
        cert_data = []
        for cert in certificates:
            # Verify certificate exists on blockchain
            if self._verify_certificate_on_blockchain(cert):
                cert_data.append({
                    "id": cert.id,
                    "display_label": cert.display_label,
                    "institution_name": cert.institution.institution_name,
                    "issued_on": cert.issued_on,
                    "file_hash": cert.file_hash,
                    "status": "ACTIVE",
                    "blockchain_verified": True,
                })
            else:
                logger.warning(f"Cert {cert.id} not on blockchain, hiding from selection")
        
        return Response({
            "certificates": cert_data,
            "total": len(cert_data)
        })

    @action(detail=True, methods=["get"], permission_classes=[IsAuthenticated])
    def shared_certificates(self, request, pk=None):
        """
        Get list of certificates already shared for this request.
        
        GET /api/access/my/requests/{id}/shared_certificates/
        
        Returns certificates that applicant has shared with employer for this request.
        Used by the revoke modal to show which certificates can be revoked.
        """
        req_obj = self.get_object()
        
        if req_obj.status != AccessRequest.Status.APPROVED:
            return Response(
                {"error": "Request is not approved"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get all shares for this request (including revoked ones for history)
        shares = AccessShare.objects.filter(
            request=req_obj
        ).select_related(
            'certificate__institution'
        ).order_by('-created_at')
        
        certificates = []
        for share in shares:
            cert = share.certificate
            certificates.append({
                "id": share.id,
                "certificate_id": cert.id,
                "file_hash": cert.file_hash,
                "title": cert.display_label,
                "issued_on": cert.issued_on,
                "issuer": cert.institution.institution_name,
                "created_at": share.created_at,
                "expiry_date": share.expiry_date,
                "is_expired": share.is_expired(),
                "is_active": share.is_active(),
                "blockchain_synced": share.blockchain_synced,
                "blockchain_tx_hash": share.blockchain_tx_hash,
                "revoked_at": share.revoked_at,
            })
        
        return Response({
            "certificates": certificates,
            "total": len(certificates)
        })

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def revoke_access(self, request, pk=None):
        """
        Revoke employer access to specific certificates.
        
        POST /api/access/my/requests/{id}/revoke_access/
        Body: {"certificate_ids": [1, 2]}
        
        ✅ FIXED: Only allows revoking blockchain-synced certificates
        """
        req_obj = self.get_object()
        
        if req_obj.status != AccessRequest.Status.APPROVED:
            return Response(
                {"error": "Can only revoke access for approved requests"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        certificate_ids = request.data.get("certificate_ids", [])
        
        if not certificate_ids:
            return Response(
                {"error": "No certificates specified"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        revoked_count = 0
        employer_id_hash = _get_employer_id_hash(req_obj.employer)
        
        for cert_id in certificate_ids:
            try:
                share = AccessShare.objects.select_related(
                    'certificate__institution'
                ).get(
                    request=req_obj,
                    certificate_id=cert_id,
                    revoked_at__isnull=True
                )
                
                # ✅ CHECK: Must be blockchain synced to revoke
                if not share.blockchain_synced:
                    logger.warning(f"Cannot revoke cert {cert_id}: not synced to blockchain")
                    continue
                
                # Revoke in database
                share.revoked_at = timezone.now()
                share.save()
                revoked_count += 1
                
                # Revoke on blockchain
                try:
                    blockchain_service = create_blockchain_service(
                        contract_address=share.certificate.institution.contract_address,
                        use_admin_wallet=True
                    )
                    
                    result = blockchain_service.remove_employer_access(
                        file_hash=share.certificate.file_hash,
                        employer_id_hash=employer_id_hash
                    )
                    
                    if result.get("success"):
                        share.revoke_tx_hash = result.get("tx_hash")
                        share.save()
                        logger.info(f"✓ Blockchain revoked for share {share.id}")
                    else:
                        logger.error(f"✗ Blockchain revoke failed for share {share.id}")
                        
                except Exception as e:
                    logger.error(f"Blockchain revoke error: {e}", exc_info=True)
                
            except AccessShare.DoesNotExist:
                logger.warning(f"Share not found for cert {cert_id}")
                continue
        
        return Response({
            "message": f"Access revoked for {revoked_count} certificate(s)",
            "revoked_count": revoked_count
        })


@extend_schema_view(
    list=extend_schema(
        tags=["Employer Access"],
        summary="List Employer Access Requests",
        description="List all access requests created by the employer.",
    ),
    retrieve=extend_schema(
        tags=["Employer Access"],
        summary="Get Access Request Details",
        description="Get details of a specific access request.",
    ),
    create=extend_schema(
        tags=["Employer Access"],
        summary="Create Access Request",
        description="Create a new access request to an applicant.",
        request=AccessRequestCreateSerializer,
    ),
    update=extend_schema(
        tags=["Employer Access"],
        summary="Update Access Request",
        description="Update an existing access request.",
    ),
    partial_update=extend_schema(
        tags=["Employer Access"],
        summary="Partial Update Access Request",
        description="Partially update an existing access request.",
    ),
    destroy=extend_schema(
        tags=["Employer Access"],
        summary="Delete Access Request",
        description="Delete an access request.",
    ),
    shared=extend_schema(
        tags=["Employer Access"],
        summary="Get Shared Certificates",
        description="Get blockchain-verified certificates shared for this request.",
    ),
)
class EmployerAccessRequestViewSet(viewsets.ModelViewSet):
    """
    Employer creates and views access requests.
    
    Endpoints:
    - GET /api/access/employer/requests/ - List requests
    - POST /api/access/employer/requests/ - Create new request
    - GET /api/access/employer/requests/{id}/shared/ - Get blockchain-verified certificates
    """
    
    serializer_class = AccessRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Return access requests for the current employer."""
        user = self.request.user
        
        try:
            employer = user.employer
        except AttributeError:
            return AccessRequest.objects.none()
        
        return AccessRequest.objects.filter(
            employer=employer
        ).select_related(
            'employer__user',
            'applicant__user'
        ).prefetch_related(
            'shares__certificate__institution'
        ).order_by('-created_at')

    def get_serializer_class(self):
        if self.action == 'create':
            return AccessRequestCreateSerializer
        return AccessRequestSerializer

    def create(self, request, *args, **kwargs):
        """Create new access request and send email notification."""
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        
        # ✅ Emit event to send request email to applicant
        access_request_created(instance)
        
        output = AccessRequestSerializer(instance)
        return Response(output.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], permission_classes=[IsAuthenticated])
    def shared(self, request, pk=None):
        """
        Get blockchain-verified shared certificates.
        
        GET /api/access/employer/requests/{id}/shared/
        
        ✅ UPDATED: Now shows revoked certificates (grayed out in frontend)
        Employers can see what was revoked with warning banner.
        """
        req_obj = self.get_object()
        employer = request.user.employer
        
        if req_obj.status != AccessRequest.Status.APPROVED:
            return Response(
                {"error": "Request is not approved", "status": req_obj.status},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # ✅ UPDATED: Include revoked certificates (removed revoked_at__isnull=True filter)
        db_shares = AccessShare.objects.filter(
            request=req_obj,
            blockchain_synced=True  # Must be synced
            # ✅ REMOVED: revoked_at__isnull=True - now shows revoked certs too
        ).select_related(
            'certificate__institution'
        ).order_by('-created_at')
        
        employer_id_hash = _get_employer_id_hash(employer)
        verified_certificates = []
        
        # Check each certificate
        for share in db_shares:
            cert = share.certificate
            
            # For revoked certificates, skip blockchain check (they're already revoked)
            if share.revoked_at:
                verified_certificates.append({
                    "id": share.id,
                    "certificate_id": cert.id,
                    "file_hash": cert.file_hash,
                    "title": cert.display_label,
                    "issued_on": cert.issued_on,
                    "issuer": cert.institution.institution_name,
                    "created_at": share.created_at,
                    "expiry_date": share.expiry_date,
                    "is_expired": share.is_expired(),
                    "is_active": False,  # Revoked = not active
                    "blockchain_synced": share.blockchain_synced,
                    "blockchain_verified": True,
                    "blockchain_tx_hash": share.blockchain_tx_hash,
                    "blockchain_expiry": 0,
                    "revoked_at": share.revoked_at,
                })
                continue
            
            # For active certificates, do blockchain verification
            blockchain_result = self._verify_on_blockchain(cert, employer_id_hash)
            
            # SKIP if blockchain says NO ACCESS (shouldn't happen but safety check)
            if not blockchain_result["has_access"]:
                logger.warning(
                    f"Blockchain denied access for cert {cert.id}. "
                    f"Reason: {blockchain_result.get('reason', 'Unknown')}"
                )
                continue
            
            # Check expiry
            blockchain_expiry = blockchain_result.get("expiry_date", 0)
            is_expired = False
            
            if blockchain_expiry > 0:
                is_expired = timezone.now().timestamp() > blockchain_expiry
            
            is_expired = is_expired or share.is_expired()
            
            # ✅ Use model's is_active() method
            is_active = share.is_active() and blockchain_result["has_access"] and not is_expired
            
            verified_certificates.append({
                "id": share.id,
                "certificate_id": cert.id,
                "file_hash": cert.file_hash,
                "title": cert.display_label,
                "issued_on": cert.issued_on,
                "issuer": cert.institution.institution_name,
                "created_at": share.created_at,
                "expiry_date": share.expiry_date,
                "is_expired": is_expired,
                "is_active": is_active,
                "blockchain_synced": share.blockchain_synced,
                "blockchain_verified": True,
                "blockchain_tx_hash": share.blockchain_tx_hash,
                "blockchain_expiry": blockchain_expiry,
                "revoked_at": share.revoked_at,
            })
        
        return Response({
            "request_id": req_obj.id,
            "applicant_name": req_obj.applicant.full_name,
            "status": req_obj.status,
            "certificates": verified_certificates,
            "total": len(verified_certificates),
            "blockchain_verified": True,
        })
    
    def _verify_on_blockchain(self, certificate, employer_id_hash: str) -> dict:
        """Verify employer access on blockchain."""
        try:
            blockchain_service = create_blockchain_service(
                contract_address=certificate.institution.contract_address,
                use_admin_wallet=False  # Read-only
            )
            
            result = blockchain_service.check_employer_access(
                file_hash=certificate.file_hash,
                employer_id_hash=employer_id_hash
            )
            
            if not result["has_access"]:
                result["reason"] = "Blockchain verification failed"
            
            return result
            
        except Exception as e:
            logger.error(f"Blockchain verification error: {e}", exc_info=True)
            return {
                "has_access": False,
                "expiry_date": 0,
                "reason": str(e)
            }


@extend_schema_view(
    retrieve=extend_schema(
        tags=["Employer Certificates"],
        summary="Get Certificate Details",
        description="Get certificate details with blockchain verification.",
    ),
    file=extend_schema(
        tags=["Employer Certificates"],
        summary="Download Certificate File",
        description="Download certificate PDF after blockchain verification. Redirects to Storacha gateway.",
    ),
)
class EmployerCertificateViewSet(viewsets.ViewSet):
    """
    Employer views certificate details with blockchain verification.
    """
    
    permission_classes = [IsAuthenticated]
    
    def retrieve(self, request, pk=None):
        """
        GET /api/access/employer/certificates/{share_id}/
        
        Get certificate details after blockchain verification.
        """
        employer = request.user.employer
        
        try:
            share = AccessShare.objects.select_related(
                'certificate__institution',
                'request'
            ).get(
                id=pk,
                request__employer=employer
            )
        except AccessShare.DoesNotExist:
            return Response(
                {"error": "Certificate not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        cert = share.certificate
        employer_id_hash = _get_employer_id_hash(employer)
        
        # BLOCKCHAIN VERIFICATION
        blockchain_result = self._verify_on_blockchain(cert, employer_id_hash)
        
        if not blockchain_result["has_access"]:
            return Response(
                {
                    "error": "Access denied",
                    "reason": blockchain_result.get("reason", "Blockchain verification failed"),
                    "blockchain_verified": False
                },
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check expiry
        blockchain_expiry = blockchain_result.get("expiry_date", 0)
        is_expired = False
        
        if blockchain_expiry > 0:
            is_expired = timezone.now().timestamp() > blockchain_expiry
        
        if is_expired or share.is_expired():
            return Response(
                {
                    "error": "Access has expired",
                    "expired_on": share.expiry_date,
                    "blockchain_expiry": blockchain_expiry
                },
                status=status.HTTP_403_FORBIDDEN
            )
        
        if share.revoked_at:
            return Response(
                {"error": "Access has been revoked", "revoked_at": share.revoked_at},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return Response({
            "id": share.id,
            "title": cert.display_label,
            "issuer": cert.institution.institution_name,
            "issued_on": cert.issued_on,
            "file_hash": cert.file_hash,
            "expiry_date": share.expiry_date,
            "is_expired": is_expired,
            "is_active": True,
            "blockchain_synced": share.blockchain_synced,
            "blockchain_verified": True,
            "blockchain_tx_hash": share.blockchain_tx_hash,
            "blockchain_expiry": blockchain_expiry,
            "tx_hash": share.blockchain_tx_hash,
            "revoked_at": share.revoked_at,
            "revoke_tx_hash": share.revoke_tx_hash,
        })
    
    @action(detail=True, methods=["get"])
    def file(self, request, pk=None):
        """
        GET /api/access/employer/certificates/{share_id}/file/
        
        ✅ FIXED: Redirect to Storacha gateway for direct download.
        """
        employer = request.user.employer
        
        try:
            share = AccessShare.objects.select_related(
                'certificate__institution',
                'request'
            ).get(
                id=pk,
                request__employer=employer
            )
        except AccessShare.DoesNotExist:
            return Response(
                {"error": "Certificate not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        cert = share.certificate
        employer_id_hash = _get_employer_id_hash(employer)
        
        # BLOCKCHAIN VERIFICATION
        blockchain_result = self._verify_on_blockchain(cert, employer_id_hash)
        
        if not blockchain_result["has_access"]:
            return Response(
                {"error": "Access denied by blockchain verification"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check expiry
        blockchain_expiry = blockchain_result.get("expiry_date", 0)
        if blockchain_expiry > 0 and timezone.now().timestamp() > blockchain_expiry:
            return Response(
                {"error": "Access has expired"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if share.is_expired():
            return Response(
                {"error": "Access has expired"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if share.revoked_at:
            return Response(
                {"error": "Access has been revoked"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # ✅ REDIRECT TO STORACHA
        if not cert.file_cid:
            return Response(
                {"error": "Certificate file not available"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Redirect browser directly to Storacha gateway
        gateway_url = f"https://{cert.file_cid}.ipfs.w3s.link"
        return redirect(gateway_url)
    
    def _verify_on_blockchain(self, certificate, employer_id_hash: str) -> dict:
        """Verify employer access on blockchain."""
        try:
            blockchain_service = create_blockchain_service(
                contract_address=certificate.institution.contract_address,
                use_admin_wallet=False
            )
            
            result = blockchain_service.check_employer_access(
                file_hash=certificate.file_hash,
                employer_id_hash=employer_id_hash
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Blockchain verification error: {e}", exc_info=True)
            return {
                "has_access": False,
                "expiry_date": 0,
                "reason": str(e)
            }