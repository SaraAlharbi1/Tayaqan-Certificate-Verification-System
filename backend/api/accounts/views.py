"""
HTTP endpoints for Accounts.

Endpoints
---------
POST /api/auth/login
    Email OR National ID + password → JWT tokens.

GET  /api/me
    Returns the current user's profile (role-aware).
    Applicant sees full national_id_plain (per your policy).

POST /api/auth/signup/applicant
POST /api/auth/signup/employer  (multipart)
POST /api/auth/signup/institution  (multipart)
    Create accounts based on the provided serializers.

GET  /api/admin/accounts/pending?role=employer|institution
PATCH /api/admin/accounts/<user_id>/status
    Basic admin moderation for org accounts.
"""
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.parsers import MultiPartParser, FormParser
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter
from drf_spectacular.openapi import OpenApiTypes
from rest_framework_simplejwt.views import TokenRefreshView as _TokenRefreshView

from .models import User, Employer, Institution
from .serializers import (
    LoginSerializer,
    MeSerializer,
    ApplicantSignupSerializer,
    EmployerSignupSerializer,
    InstitutionSignupSerializer,
    AdminStatusUpdateSerializer,
)


class LoginView(APIView):
    """POST /api/auth/login → issue JWT tokens for valid credentials."""
    permission_classes = [AllowAny]

    @extend_schema(
        tags=['Accounts'],
        summary='User Login',
        description='Authenticate user with email/national_id and password to receive JWT tokens.',
        request=LoginSerializer,
        responses={
            200: {
                'description': 'Login successful',
                'examples': {
                    'application/json': {
                        'access': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...',
                        'refresh': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...',
                    }
                }
            },
            400: {'description': 'Invalid credentials'}
        }
    )
    def post(self, request):
        ser = LoginSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        return Response(ser.validated_data, status=200)


class MeView(APIView):
    """
    GET /api/me → return profile info.

    - Applicant: include full national_id_plain (you asked to show full ID).
    - Employer/Institution: include business info + status.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Accounts'],
        summary='Get Current User Profile',
        description='Returns the authenticated user\'s profile information based on their role (Applicant, Employer, or Institution).',
        responses={
            200: MeSerializer,
            401: {'description': 'Authentication required'}
        }
    )
    def get(self, request):
        user: User = request.user
        profile = {}
        status_text = None

        if user.role == User.Roles.APPLICANT and hasattr(user, "applicant"):
            a = user.applicant
            profile = {
                "full_name": a.full_name,
                "national_id": a.national_id_plain,
                "phone": a.phone,
            }

        elif user.role == User.Roles.EMPLOYER and hasattr(user, "employer"):
            e = user.employer
            profile = {
                "full_name": e.full_name,
                "company_name": e.company_name,
                "cr_number": e.cr_number_plain,
            }
            status_text = e.status

        elif user.role == User.Roles.INSTITUTION and hasattr(user, "institution"):
            i = user.institution
            profile = {
                "institution_name": i.institution_name,
                "department": i.department,
            }
            status_text = i.status

        payload = {"id": user.id, "email": user.email, "role": user.role, "profile": profile}
        if status_text:
            payload["status"] = status_text
        return Response(MeSerializer(payload).data, status=200)


class ApplicantSignupView(APIView):
    """POST /api/auth/signup/applicant → create User + Applicant profile."""
    permission_classes = [AllowAny]

    @extend_schema(
        tags=['Accounts'],
        summary='Create Applicant Account',
        description='Register a new applicant account with personal information.',
        request=ApplicantSignupSerializer,
        responses={
            201: {
                'description': 'Applicant account created successfully',
                'examples': {
                    'application/json': {
                        'message': 'Applicant created. You can sign in now.'
                    }
                }
            },
            400: {'description': 'Invalid data provided'}
        }
    )
    def post(self, request):
        ser = ApplicantSignupSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.create(ser.validated_data)
        return Response({"message": "Applicant created. You can sign in now."}, status=201)


class EmployerSignupView(APIView):
    """POST /api/auth/signup/employer (multipart) → create User + Employer (PENDING)."""
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        tags=['Accounts'],
        summary='Create Employer Account',
        description='Register a new employer account with company information and proof documents. Account will be pending approval.',
        request=EmployerSignupSerializer,
        responses={
            201: {
                'description': 'Employer account submitted for approval',
                'examples': {
                    'application/json': {
                        'message': 'Employer submitted. Await approval.',
                        'status': 'PENDING'
                    }
                }
            },
            400: {'description': 'Invalid data provided'}
        }
    )
    def post(self, request):
        ser = EmployerSignupSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.create(ser.validated_data)
        return Response({"message": "Employer submitted. Await approval.", "status": "PENDING"}, status=201)


class InstitutionSignupView(APIView):
    """POST /api/auth/signup/institution (multipart) → create User + Institution (PENDING)."""
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        tags=['Accounts'],
        summary='Create Institution Account',
        description='Register a new educational institution account with institutional information and proof documents. Account will be pending approval.',
        request=InstitutionSignupSerializer,
        responses={
            201: {
                'description': 'Institution account submitted for approval',
                'examples': {
                    'application/json': {
                        'message': 'Institution submitted. Await approval.',
                        'status': 'PENDING'
                    }
                }
            },
            400: {'description': 'Invalid data provided'}
        }
    )
    def post(self, request):
        ser = InstitutionSignupSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.create(ser.validated_data)
        return Response({"message": "Institution submitted. Await approval.", "status": "PENDING"}, status=201)


class AdminPendingList(APIView):
    """GET /api/admin/accounts/pending?role=employer|institution → list PENDING org accounts."""
    permission_classes = [IsAuthenticated, IsAdminUser]

    @extend_schema(
        tags=['Accounts'],
        summary='List Pending Accounts',
        description='Admin endpoint to list all pending employer or institution accounts awaiting approval.',
        parameters=[
            OpenApiParameter(
                name='role',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description='Filter by role: employer or institution',
                enum=['employer', 'institution']
            ),
        ],
        responses={
            200: {
                'description': 'List of pending accounts',
                'examples': {
                    'application/json': {
                        'results': [
                            {
                                'id': 1,
                                'email': 'company@example.com',
                                'company_name': 'Example Corp',
                                'status': 'PENDING'
                            }
                        ]
                    }
                }
            },
            401: {'description': 'Authentication required'},
            403: {'description': 'Admin access required'}
        }
    )
    def get(self, request):
        role = request.query_params.get("role")
        if role == "employer":
            data = [
                {"id": e.user.id, "email": e.user.email, "company_name": e.company_name, "status": e.status}
                for e in Employer.objects.filter(status=Employer.Status.PENDING)
            ]
            return Response({"results": data})
        elif role == "institution":
            data = [
                {"id": i.user.id, "email": i.user.email, "institution_name": i.institution_name, "status": i.status}
                for i in Institution.objects.filter(status=Institution.Status.PENDING)
            ]
            return Response({"results": data})
        return Response({"results": []})


class AdminUpdateStatus(APIView):
    """PATCH /api/admin/accounts/<user_id>/status → approve/reject an org account."""
    permission_classes = [IsAuthenticated, IsAdminUser]

    @extend_schema(
        tags=['Accounts'],
        summary='Update Account Status',
        description='Admin endpoint to approve or reject pending employer/institution accounts.',
        request=AdminStatusUpdateSerializer,
        responses={
            200: {
                'description': 'Account status updated successfully',
                'examples': {
                    'application/json': {
                        'id': 1,
                        'role': 'EMPLOYER',
                        'status': 'APPROVED'
                    }
                }
            },
            400: {'description': 'Invalid data or no moderatable profile'},
            401: {'description': 'Authentication required'},
            403: {'description': 'Admin access required'},
            404: {'description': 'User not found'}
        }
    )
    def patch(self, request, user_id: int):
        ser = AdminStatusUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        status = ser.validated_data["status"]
        notes = ser.validated_data.get("notes", "")

        user = get_object_or_404(User, id=user_id)

        if user.role == User.Roles.EMPLOYER and hasattr(user, "employer"):
            e = user.employer
            e.status = status
            e.status_notes = notes
            e.save()
            return Response({"id": user.id, "role": "EMPLOYER", "status": e.status})

        if user.role == User.Roles.INSTITUTION and hasattr(user, "institution"):
            i = user.institution
            i.status = status
            i.status_notes = notes
            i.save()
            return Response({"id": user.id, "role": "INSTITUTION", "status": i.status})

        return Response({"message": "No moderatable profile for this user."}, status=400)


@extend_schema_view(
    # Swagger grouping: put this operation under the "Accounts" header
    post=extend_schema(tags=["Accounts"], summary="Refresh JWT access token")
)
class TokenRefreshView(_TokenRefreshView):
    """
    Wrapper around SimpleJWT's TokenRefreshView so it shows under the
    'Accounts' section in Swagger.
    """
    pass
