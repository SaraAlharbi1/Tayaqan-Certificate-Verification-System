"""
HTTP endpoints for Accounts.
"""
from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import status
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
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
)


class LoginView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Accounts"],
        summary="User Login",
        description="Authenticate with email or national ID and password to receive JWT tokens.",
        request=LoginSerializer,
        responses={200: LoginSerializer},
    )
    def post(self, request):
        ser = LoginSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        return Response(ser.validated_data, status=status.HTTP_200_OK)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Accounts"],
        summary="Get Current User Profile",
        responses={200: MeSerializer, 401: {"description": "Authentication required"}},
    )
    def get(self, request):
        user: User = request.user
        profile = {}
        status_text = None

        # Applicant fields
        if user.role == User.Roles.APPLICANT and hasattr(user, "applicant"):
            a = user.applicant
            profile = {
                "full_name": a.full_name,
                "national_id": a.national_id_plain,
                "phone": a.phone,
            }

        # Employer fields
        elif user.role == User.Roles.EMPLOYER and hasattr(user, "employer"):
            e = user.employer
            profile = {
                "full_name": e.full_name,
                "company_name": e.company_name,
                "cr_number": e.cr_number_plain,
            }
            status_text = e.status

        # Institution fields (add phone/official_email so frontend can show them)
        elif user.role == User.Roles.INSTITUTION and hasattr(user, "institution"):
            i: Institution = user.institution
            profile = {
                "institution_name": i.institution_name,
                "department": i.department,
                "phone": getattr(i, "phone", None),
                "official_email": getattr(i, "official_email", None),
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


class ApplicantSignupView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Accounts"],
        summary="Create Applicant Account",
        request=ApplicantSignupSerializer,
        responses={201: {"description": "Created"}},
    )
    def post(self, request):
        ser = ApplicantSignupSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.create(ser.validated_data)
        return Response({"message": "Applicant created. You can sign in now."}, status=status.HTTP_201_CREATED)


class EmployerSignupView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        tags=["Accounts"],
        summary="Create Employer Account",
        request=EmployerSignupSerializer,
        responses={201: {"description": "Submitted"}},
    )
    def post(self, request):
        ser = EmployerSignupSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.create(ser.validated_data)
        return Response({"message": "Employer submitted. Await approval.", "status": "PENDING"}, status=201)


class InstitutionSignupView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        tags=["Accounts"],
        summary="Create Institution Account",
        request=InstitutionSignupSerializer,
        responses={201: {"description": "Submitted"}},
    )
    def post(self, request):
        ser = InstitutionSignupSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.create(ser.validated_data)
        return Response({"message": "Institution submitted. Await approval.", "status": "PENDING"}, status=201)


class AdminPendingList(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    @extend_schema(
        tags=["Accounts"],
        summary="List Pending Accounts",
        parameters=[
            OpenApiParameter(
                name="role",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                enum=["employer", "institution"],
                description="Filter by role",
            )
        ],
    )
    def get(self, request):
        role = request.query_params.get("role")
        if role == "employer":
            data = [
                {"id": e.user.id, "email": e.user.email, "company_name": e.company_name, "status": e.status}
                for e in Employer.objects.filter(status=Employer.Status.PENDING)
            ]
            return Response({"results": data}, status=200)
        if role == "institution":
            data = [
                {"id": i.user.id, "email": i.user.email, "institution_name": i.institution_name, "status": i.status}
                for i in Institution.objects.filter(status=Institution.Status.PENDING)
            ]
            return Response({"results": data}, status=200)
        return Response({"results": []}, status=200)


class AdminUpdateStatus(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    @extend_schema(
        tags=["Accounts"],
        summary="Update Account Status",
        request=AdminStatusUpdateSerializer,
    )
    def patch(self, request, user_id: int):
        ser = AdminStatusUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        status_choice = ser.validated_data["status"]
        notes = ser.validated_data.get("notes", "")

        user = get_object_or_404(User, id=user_id)

        if user.role == User.Roles.EMPLOYER and hasattr(user, "employer"):
            e = user.employer
            e.status = status_choice
            e.status_notes = notes
            e.save(update_fields=["status", "status_notes"])
            return Response({"id": user.id, "role": "EMPLOYER", "status": e.status}, status=200)

        if user.role == User.Roles.INSTITUTION and hasattr(user, "institution"):
            i = user.institution
            i.status = status_choice
            i.status_notes = notes
            i.save(update_fields=["status", "status_notes"])
            return Response({"id": user.id, "role": "INSTITUTION", "status": i.status}, status=200)

        return Response({"message": "No moderatable profile for this user."}, status=400)


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Accounts"],
        summary="Request Password Reset",
        request=PasswordResetRequestSerializer,
    )
    def post(self, request):
        ser = PasswordResetRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save(frontend_base=getattr(settings, "FRONTEND_RESET_URL", "http://localhost:5173/reset-password"))
        return Response({"detail": "If the email exists, a reset link was sent."}, status=200)


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Accounts"],
        summary="Confirm Password Reset",
        request=PasswordResetConfirmSerializer,
    )
    def post(self, request):
        ser = PasswordResetConfirmSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response({"detail": "Password has been reset."}, status=200)


@extend_schema_view(post=extend_schema(tags=["Accounts"], summary="Refresh JWT"))
class TokenRefreshView(_TokenRefreshView):
    pass
