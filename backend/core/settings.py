"""
Django settings for backend project (dev).
"""

from pathlib import Path
import os
from datetime import timedelta
from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


# ------------------------------------------------------------------ Core
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-only-secret")
DEBUG = os.getenv("DEBUG", "true").lower() == "true"
ALLOWED_HOSTS = ["127.0.0.1", "localhost"]


# ------------------------------------------------------------------ Apps
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third party
    "rest_framework",
    "rest_framework_simplejwt",
    "drf_spectacular",
    "drf_spectacular_sidecar",
    "corsheaders",
    "django_filters",

    # Project apps
    "api.accounts",
    "api.certificates",
    "api.access",
]


# ------------------------------------------------------------------ Middleware
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",            # MUST BE FIRST
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]


ROOT_URLCONF = "core.urls"


# ------------------------------------------------------------------ Templates
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "core.wsgi.application"


# ------------------------------------------------------------------ Database (SQLite dev)
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}


# ------------------------------------------------------------------ Auth
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

AUTH_USER_MODEL = "accounts.User"


# ------------------------------------------------------------------ I18N
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True


# ------------------------------------------------------------------ Static / Media
STATIC_URL = "/static/"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# ------------------------------------------------------------------ DRF
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 10,
}


# ------------------------------------------------------------------ Spectacular (Swagger)
SPECTACULAR_SETTINGS = {
    "TITLE": "Tayaqan API",
    "DESCRIPTION": "Blockchain-Based Certificate Verification Platform",
    "VERSION": "1.0.0",
    "SECURITY": [{"JWTAuth": []}],
    "COMPONENTS": {
        "securitySchemes": {
            "JWTAuth": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
        }
    },
    "SWAGGER_UI_SETTINGS": {
        "tagsSorter": "alpha",
        "operationsSorter": "alpha",
        "displayOperationId": True,
    },
    "TAGS": [
        # Authentication & Registration
        {"name": "Authentication", "description": "Login, logout, JWT refresh, password reset."},
        {"name": "Registration", "description": "Signup for Applicant, Employer, Institution."},
        
        # Admin
        {"name": "Admin", "description": "Admin account moderation (approve/reject)."},
        
        # Applicants
        {"name": "Applicants", "description": "Applicant verification endpoints."},
        
        # Certificates
        {"name": "Institution Certificates", "description": "Institution issues, revokes, and manages certificates."},
        {"name": "Applicant Certificates", "description": "Applicant views and verifies own certificates."},
        
        # Access Control
        {"name": "Applicant Access", "description": "Applicant manages incoming access requests."},
        {"name": "Employer Access", "description": "Employer creates and views access requests."},
        {"name": "Employer Certificates", "description": "Employer views shared certificates with blockchain verification."},
    ],
}


# ------------------------------------------------------------------ JWT
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("JWT_ACCESS_MIN", "60"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.getenv("JWT_REFRESH_DAYS", "7"))),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}


# ------------------------------------------------------------------ CORS (FIXED)
CORS_ALLOW_ALL_ORIGINS = False

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

CORS_ALLOW_CREDENTIALS = True

CORS_ALLOW_HEADERS = [
    "accept",
    "accept-language",
    "content-type",
    "origin",
    "authorization",
    "x-csrftoken",
    "x-requested-with",
]

CORS_ALLOW_METHODS = [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
]


# ------------------------------------------------------------------ Email
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "true").lower() == "true"
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER)


# ------------------------------------------------------------------ Blockchain
WEB3_RPC_URL = os.getenv("WEB3_RPC_URL", "http://127.0.0.1:8545")
BLOCKCHAIN_RPC_URL = WEB3_RPC_URL
CHAIN_ID = os.getenv("CHAIN_ID", "31337")
ADMIN_PRIVATE_KEY = os.getenv("ADMIN_PRIVATE_KEY", "")
INSTITUTION_REGISTRY_ADDRESS = os.getenv("INSTITUTION_REGISTRY_ADDRESS", "")