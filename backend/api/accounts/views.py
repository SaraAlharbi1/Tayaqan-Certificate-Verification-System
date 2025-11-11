# backend/api/accounts/views.py
"""HTTP endpoints for Accounts (router + ViewSets)."""
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

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


# ---------- Auth ----------
@extend_schema_view(
    login=extend_schema(
        tags=["1. Accounts"],
        summary="01. User Login",
        description="Authenticate with email or national ID and password to receive JWT tokens.",
        request=LoginSerializer,
        responses={200: LoginSerializer},
        operation_id="01_accounts_login",
    ),
    refresh=extend_schema(
        tags=["1. Accounts"],
        summary="02. Refresh JWT",
        request=TokenRefreshSerializer,
        responses={200: TokenRefreshSerializer},
        operation_id="02_accounts_refresh",
    ),
    me=extend_schema(
        tags=["1. Accounts"],
        summary="03. Get Current User Profile",
        responses={200: MeSerializer, 401: {"description": "Authentication required"}},
        operation_id="03_accounts_me",
    ),
)
class AuthViewSet(viewsets.GenericViewSet):
    """Routes: POST /auth/login, POST /auth/refresh, GET /auth/me."""
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
        """Return current user + role profile; include 'status' for moderated roles."""
        user: User = request.user
        profile = {}
        status_text = None

        if user.role == User.Roles.APPLICANT and hasattr(user, "applicant"):
            a = user.applicant
            profile = {"full_name": a.full_name, "national_id": a.national_id_plain, "phone": a.phone}
        elif user.role == User.Roles.EMPLOYER and hasattr(user, "employer"):
            e = user.employer
            profile = {
                "full_name": e.full_name,
                "company_name": e.company_name,
                "cr_number": e.cr_number_plain,
            }
            status_text = e.status
        elif user.role == User.Roles.INSTITUTION and hasattr(user, "institution"):
            i: Institution = user.institution
            profile = {
                "institution_name": i.institution_name,
                "department": i.department,
                "phone": getattr(i, "phone", None),
                "official_email": getattr(i, "official_email", None),
            }
            status_text = i.status

        payload = {"id": user.id, "email": user.email, "role": user.role, "profile": profile}
        if status_text:
            payload["status"] = status_text

        return Response(MeSerializer(payload).data, status=status.HTTP_200_OK)


# ---------- Signup ----------
@extend_schema_view(
    applicant=extend_schema(
        tags=["1. Accounts"],
        summary="04. Create Applicant Account",
        request=ApplicantSignupSerializer,
        responses={201: {"description": "Created"}},
        operation_id="04_accounts_signup_applicant",
    ),
    employer=extend_schema(
        tags=["1. Accounts"],
        summary="05. Create Employer Account",
        request=EmployerSignupSerializer,
        responses={201: {"description": "Submitted"}},
        operation_id="05_accounts_signup_employer",
    ),
    institution=extend_schema(
        tags=["1. Accounts"],
        summary="06. Create Institution Account",
        request=InstitutionSignupSerializer,
        responses={201: {"description": "Submitted"}},
        operation_id="06_accounts_signup_institution",
    ),
)
class SignupViewSet(viewsets.GenericViewSet):
    """Routes: POST /signup/applicant|employer|institution."""
    queryset = User.objects.none()
    permission_classes = [AllowAny]

    @action(methods=["post"], detail=False, url_path="applicant")
    def applicant(self, request):
        ser = ApplicantSignupSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.create(ser.validated_data)
        return Response({"message": "Applicant created. You can sign in now."}, status=status.HTTP_201_CREATED)

    @action(methods=["post"], detail=False, url_path="employer", parser_classes=[MultiPartParser, FormParser])
    def employer(self, request):
        ser = EmployerSignupSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.create(ser.validated_data)
        return Response({"message": "Employer submitted. Await approval.", "status": "PENDING"}, status=201)

    @action(methods=["post"], detail=False, url_path="institution", parser_classes=[MultiPartParser, FormParser])
    def institution(self, request):
        ser = InstitutionSignupSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.create(ser.validated_data)
        return Response({"message": "Institution submitted. Await approval.", "status": "PENDING"}, status=201)


# ---------- Admin moderation ----------
@extend_schema_view(
    pending=extend_schema(
        tags=["1. Accounts"],
        summary="07. List Pending Accounts",
        parameters=[
            OpenApiParameter(
                name="role",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                enum=["employer", "institution"],
                description="Filter by role",
            )
        ],
        operation_id="07_accounts_pending",
    ),
    status=extend_schema(
        tags=["1. Accounts"],
        summary="08. Update Account Status",
        request=AdminStatusUpdateSerializer,
        operation_id="08_accounts_update_status",
    ),
)
class AdminAccountsViewSet(viewsets.GenericViewSet):
    """Routes: GET /admin/accounts/pending, PATCH /admin/accounts/{user_id}/status."""
    queryset = User.objects.all()
    permission_classes = [IsAuthenticated, IsAdminUser]

    @action(methods=["get"], detail=False, url_path="pending")
    def pending(self, request):
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

    @action(methods=["patch"], detail=True, url_path="status")
    def status(self, request, pk=None):
        """Update Employer/Institution status and email them (HTML + plain fallback)."""
        ser = AdminStatusUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        status_choice = ser.validated_data["status"]
        notes = ser.validated_data.get("notes", "")

        user = get_object_or_404(User, id=pk)
        frontend = getattr(settings, "FRONTEND_URL", "http://localhost:5173").rstrip("/")
        dashboard_url = f"{frontend}/"

        # helper to send HTML + plain (and don't hide failures)
        def send_status_email(to_email: str, name: str, kind: str):
            ctx = {
                "name": name,
                "kind": kind,
                "status": status_choice,
                "notes": notes,
                "dashboard_url": dashboard_url,
            }
            html = render_to_string("Registration_update.html", ctx)
            text = strip_tags(html)
            send_mail(
                subject=f"{kind} registration {status_choice}",
                message=text,
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "Tayaqan <no-reply@tayaqan.local>"),
                recipient_list=[to_email],
                fail_silently=False,  # surface email errors
                html_message=html,
            )

        if user.role == User.Roles.EMPLOYER and hasattr(user, "employer"):
            e: Employer = user.employer
            e.status = status_choice
            e.status_notes = notes
            e.save(update_fields=["status", "status_notes"])
            name = (e.full_name or "").strip() or user.email.split("@")[0]
            if user.email:
                send_status_email(user.email, name, "Employer")
            return Response({"id": user.id, "role": "EMPLOYER", "status": e.status}, status=200)

        if user.role == User.Roles.INSTITUTION and hasattr(user, "institution"):
            i: Institution = user.institution
            i.status = status_choice
            i.status_notes = notes
            i.save(update_fields=["status", "status_notes"])
            name = (getattr(i, "contact_name", "") or "").strip() or user.email.split("@")[0]
            if user.email:
                send_status_email(user.email, name, "Institution")
            return Response({"id": user.id, "role": "INSTITUTION", "status": i.status}, status=200)

        return Response({"message": "No moderatable profile for this user."}, status=400)


# ---------- Password reset ----------
@extend_schema_view(
    request_link=extend_schema(
        tags=["1. Accounts"],
        summary="09. Request Password Reset",
        request=PasswordResetRequestSerializer,
        operation_id="09_accounts_password_request",
    ),
    confirm=extend_schema(
        tags=["1. Accounts"],
        summary="10. Confirm Password Reset",
        request=PasswordResetConfirmSerializer,
        operation_id="10_accounts_password_confirm",
    ),
)
class PasswordViewSet(viewsets.GenericViewSet):
    """Routes: POST /password/request, POST /password/confirm."""
    queryset = User.objects.none()

    @action(methods=["post"], detail=False, url_path="request", permission_classes=[AllowAny])
    def request_link(self, request):
        ser = PasswordResetRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save(frontend_base=getattr(settings, "FRONTEND_RESET_URL", "http://localhost:5173/reset-password"))
        return Response({"detail": "If the email exists, a reset link was sent."}, status=200)

    @action(methods=["post"], detail=False, url_path="confirm", permission_classes=[AllowAny])
    def confirm(self, request):
        ser = PasswordResetConfirmSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response({"detail": "Password has been reset."}, status=200)
