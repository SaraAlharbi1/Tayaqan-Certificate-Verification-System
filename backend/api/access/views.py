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

from .models import AccessRequest, AccessShare
from .serializers import (
    AccessRequestSerializer,
    AccessRequestCreateSerializer,
    AccessApproveSerializer,
    AccessShareSerializer,
)
from api.certificates.models import Certificate
from helper.blockchain_service import create_blockchain_service

logger = logging.getLogger(__name__)


def _get_employer_id_hash(employer) -> str:
    """Generate employer ID hash for blockchain verification."""
    return Web3.solidity_keccak(['string'], [employer.official_email]).hex()


class ApplicantAccessRequestViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Applicant views and manages incoming access requests.
    
    Endpoints:
    - GET /api/access/my/requests/ - List all requests
    - GET /api/access/my/requests/{id}/ - Get specific request
    - POST /api/access/my/requests/{id}/approve/ - Approve request with blockchain sync
    - POST /api/access/my/requests/{id}/reject/ - Reject request
    - GET /api/access/my/requests/{id}/candidate_certificates/ - List shareable certificates
    - POST /api/access/my/requests/{id}/revoke_access/ - Revoke shared certificates
    """
    
    serializer_class = AccessRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Return access requests for the current applicant."""
        user = self.request.user
        
        try:
            applicant = user.applicant_profile
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
        2. Approve request in database
        3. Create AccessShare records
        4. Sync to blockchain (signed by admin wallet)
        5. Return success with blockchain sync status
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

        # Approve the request
        req_obj.approve()
        req_obj.save()

        shares_created = 0
        blockchain_synced = 0
        blockchain_errors = []
        
        # Get employer ID hash for blockchain
        employer_id_hash = _get_employer_id_hash(req_obj.employer)
        
        # Create shares and sync to blockchain
        for cert_id in certificate_ids:
            try:
                cert = Certificate.objects.select_related('institution').get(
                    id=cert_id, 
                    applicant=req_obj.applicant
                )
                
                # Calculate expiry date
                expiry_date_dt = None
                expiry_timestamp = 0
                
                if expiry_days > 0:
                    expiry_date_dt = timezone.now() + timedelta(days=expiry_days)
                    expiry_timestamp = int(expiry_date_dt.timestamp())
                
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
                        contract_address=cert.institution.contract_address,  # ✅ FIXED
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
                            f"✓ Blockchain synced for cert {cert_id}: {result.get('tx_hash')}"
                        )
                    else:
                        blockchain_errors.append({
                            "certificate_id": cert_id,
                            "certificate_name": cert.display_label,
                            "error": result.get("error", "Unknown error")
                        })
                        logger.error(
                            f"✗ Blockchain sync failed for cert {cert_id}: {result.get('error')}"
                        )
                        
                except Exception as e:
                    blockchain_errors.append({
                        "certificate_id": cert_id,
                        "certificate_name": cert.display_label,
                        "error": str(e)
                    })
                    logger.error(
                        f"✗ Exception during blockchain sync for cert {cert_id}: {e}",
                        exc_info=True
                    )
                
            except Certificate.DoesNotExist:
                logger.warning(f"Certificate {cert_id} not found")
            except Exception as e:
                logger.error(f"Error creating share for cert {cert_id}: {e}", exc_info=True)

        # Send email notification (optional)
        try:
            from .utils import send_status_update_email
            send_status_update_email(req_obj)
        except Exception as e:
            logger.error(f"Failed to send email: {e}")

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

        return Response(response_data, status=status.HTTP_200_OK)

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

        # Send email notification
        try:
            from .utils import send_status_update_email
            send_status_update_email(req_obj)
        except Exception as e:
            logger.error(f"Failed to send email: {e}")

        return Response(
            {"message": "Request rejected successfully"},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=["get"], permission_classes=[IsAuthenticated])
    def candidate_certificates(self, request, pk=None):
        """
        Get list of certificates that can be shared for this request.
        
        GET /api/access/my/requests/{id}/candidate_certificates/
        """
        req_obj = self.get_object()
        
        certificates = Certificate.objects.filter(
            applicant=req_obj.applicant,
            revoked_at__isnull=True
        ).select_related('institution').order_by('-issued_on')
        
        cert_data = []
        for cert in certificates:
            cert_data.append({
                "id": cert.id,
                "display_label": cert.display_label,
                "institution_name": cert.institution.institution_name,
                "issued_on": cert.issued_on,
                "file_hash": cert.file_hash,
                "status": "REVOKED" if cert.revoked_at else "ACTIVE",
            })
        
        return Response({
            "certificates": cert_data,
            "total": len(cert_data)
        })

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def revoke_access(self, request, pk=None):
        """
        Revoke employer access to specific certificates.
        
        POST /api/access/my/requests/{id}/revoke_access/
        Body: {"certificate_ids": [1, 2]}
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
                
                # Revoke in database
                share.revoked_at = timezone.now()
                share.save()
                revoked_count += 1
                
                # Revoke on blockchain
                try:
                    blockchain_service = create_blockchain_service(
                        contract_address=share.certificate.institution.contract_address,  # ✅ FIXED
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
            employer = user.employer_profile
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
        """Create new access request."""
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        
        output = AccessRequestSerializer(instance)
        return Response(output.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], permission_classes=[IsAuthenticated])
    def shared(self, request, pk=None):
        """
        Get blockchain-verified shared certificates.
        
        GET /api/access/employer/requests/{id}/shared/
        
        CRITICAL: Only returns certificates verified on blockchain.
        Certificates without blockchain approval are hidden.
        """
        req_obj = self.get_object()
        employer = request.user.employer_profile
        
        if req_obj.status != AccessRequest.Status.APPROVED:
            return Response(
                {"error": "Request is not approved", "status": req_obj.status},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get shares from database
        db_shares = AccessShare.objects.filter(
            request=req_obj
        ).select_related(
            'certificate__institution'
        ).order_by('-created_at')
        
        employer_id_hash = _get_employer_id_hash(employer)
        verified_certificates = []
        
        # CHECK EACH CERTIFICATE ON BLOCKCHAIN BEFORE SHOWING
        for share in db_shares:
            cert = share.certificate
            
            # BLOCKCHAIN VERIFICATION
            blockchain_result = self._verify_on_blockchain(cert, employer_id_hash)
            
            # SKIP if blockchain says NO ACCESS
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
            is_revoked = share.revoked_at is not None
            is_active = blockchain_result["has_access"] and not is_expired and not is_revoked
            
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
                contract_address=certificate.institution.contract_address,  # ✅ FIXED
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
        employer = request.user.employer_profile
        
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
        
        Download PDF after blockchain verification.
        """
        employer = request.user.employer_profile
        
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
        
        # Serve PDF
        try:
            file_path = cert.file.path
            with open(file_path, 'rb') as f:
                response = HttpResponse(f.read(), content_type='application/pdf')
                response['Content-Disposition'] = f'attachment; filename="certificate-{cert.id}.pdf"'
                return response
        except Exception as e:
            logger.error(f"Error serving file: {e}")
            return Response(
                {"error": "Failed to retrieve file"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _verify_on_blockchain(self, certificate, employer_id_hash: str) -> dict:
        """Verify employer access on blockchain."""
        try:
            blockchain_service = create_blockchain_service(
                contract_address=certificate.institution.contract_address,  # ✅ FIXED
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