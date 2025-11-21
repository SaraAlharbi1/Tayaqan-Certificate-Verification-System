"""
API views for Accounts domain.
Handles: auth, signup, admin moderation, password reset.
"""

from django.conf import settings
from django.shortcuts import get_object_or_404

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from .models import Applicant

from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter
from drf_spectacular.openapi import OpenApiTypes

from rest_framework_simplejwt.serializers import TokenRefreshSerializer

from .models import User, Employer, Institution
from .serializers import (
    LoginSerializer,
    MeSerializer,
    ApplicantSignupSerializer,
    EmployerSignupSerializer,
    InstitutionSignupSerializer,
    AdminStatusUpdateSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
)
from .events import employer_approved, institution_approved


# ============================================================
# Authentication
# ============================================================

@extend_schema_view(
    login=extend_schema(
        tags=["Accounts"],
        summary="User Login",
        description="Login with email/national ID + password. Returns JWT tokens.",
        request=LoginSerializer,
        responses={200: LoginSerializer},
    ),
    refresh=extend_schema(
        tags=["Accounts"],
        summary="Refresh JWT Token",
        request=TokenRefreshSerializer,
        responses={200: TokenRefreshSerializer},
    ),
    me=extend_schema(
        tags=["Accounts"],
        summary="Get Current User",
        responses={200: MeSerializer},
    ),
)
class AuthViewSet(viewsets.GenericViewSet):
    """Auth endpoints: login, refresh, me."""
    
    queryset = User.objects.none()
    permission_classes = [AllowAny]

    @action(methods=["post"], detail=False, url_path="login", permission_classes=[AllowAny])
    def login(self, request):
        ser = LoginSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        return Response(ser.validated_data, status=status.HTTP_200_OK)

    @action(methods=["post"], detail=False, url_path="refresh", permission_classes=[AllowAny])
    def refresh(self, request):
        ser = TokenRefreshSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        return Response(ser.validated_data, status=status.HTTP_200_OK)

    @action(methods=["get"], detail=False, url_path="me", permission_classes=[IsAuthenticated])
    def me(self, request):
        """Return current user profile."""
        user = request.user
        profile = {}
        status_text = None

        if user.role == User.Roles.APPLICANT and hasattr(user, "applicant"):
            a = user.applicant
            profile = {
                "full_name": a.full_name,
                "national_id": a.national_id_plain,
                "wallet_address": a.wallet_address,
                "phone": a.phone,
            }

        elif user.role == User.Roles.EMPLOYER and hasattr(user, "employer"):
            e = user.employer
            profile = {
                "full_name": e.full_name,
                "company_name": e.company_name,
                "official_email": e.official_email,
                "phone": e.phone,
            }
            status_text = e.status

        elif user.role == User.Roles.INSTITUTION and hasattr(user, "institution"):
            i = user.institution
            profile = {
                "institution_name": i.institution_name,
                "institution_id": i.institution_id,
                "official_email": i.official_email,
                "phone": i.phone,
                "wallet_address": i.wallet_address,
                "contract_address": i.contract_address,
            }
            status_text = i.status

        payload = {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "profile": profile,
        }
        if status_text:
            payload["status"] = status_text

        return Response(MeSerializer(payload).data, status=status.HTTP_200_OK)


# ============================================================
# Signup
# ============================================================

@extend_schema_view(
    applicant=extend_schema(
        tags=["Accounts"],
        summary="Signup as Applicant",
        request=ApplicantSignupSerializer,
        responses={201: {"description": "Created"}},
    ),
    employer=extend_schema(
        tags=["Accounts"],
        summary="Signup as Employer",
        request=EmployerSignupSerializer,
        responses={201: {"description": "Submitted for approval"}},
    ),
    institution=extend_schema(
        tags=["Accounts"],
        summary="Signup as Institution",
        request=InstitutionSignupSerializer,
        responses={201: {"description": "Submitted for approval"}},
    ),
)
class SignupViewSet(viewsets.GenericViewSet):
    """Signup endpoints for all roles."""
    
    queryset = User.objects.none()
    permission_classes = [AllowAny]

    @action(methods=["post"], detail=False, url_path="applicant")
    def applicant(self, request):
        ser = ApplicantSignupSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.create(ser.validated_data)
        return Response(
            {"message": "Account created. You can sign in now."},
            status=status.HTTP_201_CREATED
        )

    @action(methods=["post"], detail=False, url_path="employer", parser_classes=[MultiPartParser, FormParser])
    def employer(self, request):
        ser = EmployerSignupSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.create(ser.validated_data)
        return Response(
            {"message": "Application submitted. Await admin approval.", "status": "PENDING"},
            status=status.HTTP_201_CREATED,
        )

    @action(methods=["post"], detail=False, url_path="institution", parser_classes=[MultiPartParser, FormParser])
    def institution(self, request):
        ser = InstitutionSignupSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.create(ser.validated_data)
        return Response(
            {"message": "Application submitted. Await admin approval.", "status": "PENDING"},
            status=status.HTTP_201_CREATED,
        )


# ============================================================
# Admin Moderation
# ============================================================

@extend_schema_view(
    pending=extend_schema(
        tags=["Admin"],
        summary="List Pending Accounts",
        parameters=[
            OpenApiParameter(
                name="role",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                enum=["employer", "institution"],
            )
        ],
    ),
    status=extend_schema(
        tags=["Admin"],
        summary="Update Account Status",
        description="Approve/reject employer or institution. Triggers blockchain deployment on approval.",
        request=AdminStatusUpdateSerializer,
    ),
)
class AdminAccountsViewSet(viewsets.GenericViewSet):
    """Admin endpoints for account moderation."""
    
    queryset = User.objects.all()
    permission_classes = [IsAuthenticated, IsAdminUser]

    @action(methods=["get"], detail=False, url_path="pending")
    def pending(self, request):
        """List pending accounts by role."""
        role = request.query_params.get("role")
        
        if role == "employer":
            data = [
                {
                    "id": e.user.id,
                    "email": e.user.email,
                    "company_name": e.company_name,
                    "status": e.status,
                }
                for e in Employer.objects.filter(status=Employer.Status.PENDING)
            ]
            return Response({"results": data}, status=status.HTTP_200_OK)

        if role == "institution":
            data = [
                {
                    "id": i.user.id,
                    "email": i.user.email,
                    "institution_name": i.institution_name,
                    "status": i.status,
                }
                for i in Institution.objects.filter(status=Institution.Status.PENDING)
            ]
            return Response({"results": data}, status=status.HTTP_200_OK)

        return Response({"results": []}, status=status.HTTP_200_OK)

    @action(methods=["patch"], detail=True, url_path="status")
    def status(self, request, pk=None):
        """
        Approve or reject account.
        Institution approval triggers automatic blockchain deployment.
        """
        ser = AdminStatusUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        status_choice = ser.validated_data["status"]

        user = get_object_or_404(User, id=pk)

        # Handle employer approval
        if user.role == User.Roles.EMPLOYER and hasattr(user, "employer"):
            e = user.employer
            e.status = status_choice
            e.save(update_fields=["status"])
            if status_choice == Employer.Status.APPROVED:
                employer_approved(e)
            return Response(
                {"id": user.id, "role": "EMPLOYER", "status": e.status},
                status=status.HTTP_200_OK
            )

        # Handle institution approval (triggers blockchain deployment)
        if user.role == User.Roles.INSTITUTION and hasattr(user, "institution"):
            inst = user.institution
            inst.status = status_choice
            inst.save(update_fields=["status"])
            if status_choice == Institution.Status.APPROVED:
                institution_approved(inst)  # Auto-deploys contract
            return Response(
                {
                    "id": user.id,
                    "role": "INSTITUTION",
                    "status": inst.status,
                    "institution_id": inst.institution_id,
                    "contract_address": inst.contract_address,
                },
                status=status.HTTP_200_OK,
            )

        return Response(
            {"message": "No moderatable profile found"},
            status=status.HTTP_400_BAD_REQUEST
        )


# ============================================================
# Password Reset
# ============================================================

@extend_schema_view(
    request_link=extend_schema(
        tags=["Accounts"],
        summary="Request Password Reset",
        request=PasswordResetRequestSerializer,
    ),
    confirm=extend_schema(
        tags=["Accounts"],
        summary="Confirm Password Reset",
        request=PasswordResetConfirmSerializer,
    ),
)
class PasswordViewSet(viewsets.GenericViewSet):
    """Password reset endpoints."""
    
    queryset = User.objects.none()

    @action(methods=["post"], detail=False, url_path="request", permission_classes=[AllowAny])
    def request_link(self, request):
        ser = PasswordResetRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save(frontend_base=getattr(settings, "FRONTEND_RESET_URL", "http://localhost:5173/reset-password"))
        return Response(
            {"detail": "If email exists, reset link was sent."},
            status=status.HTTP_200_OK
        )

    @action(methods=["post"], detail=False, url_path="confirm", permission_classes=[AllowAny])
    def confirm(self, request):
        ser = PasswordResetConfirmSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(
            {"detail": "Password reset successful."},
            status=status.HTTP_200_OK
        )
        
        
        
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def verify_applicant(request, national_id):
    """
    Verify if an applicant exists by national ID and return their basic info.
    Used by employers when creating access requests.
    
    GET /api/accounts/applicants/verify/{national_id}/
    """
    try:
        applicant = Applicant.objects.select_related('user').get(
            national_id_plain=national_id
        )
        
        return Response({
            'full_name': applicant.full_name,
            'email': applicant.user.email if applicant.user else None,
        }, status=status.HTTP_200_OK)
        
    except Applicant.DoesNotExist:
        return Response(
            {
                'detail': 'Applicant not found with this national ID',
                'error': 'NOT_FOUND'
            },
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {
                'detail': 'An error occurred while verifying the applicant',
                'error': str(e)
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
