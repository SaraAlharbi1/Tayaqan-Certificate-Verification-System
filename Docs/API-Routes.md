# Tayaqan API Routes

## Overview

This document describes the API endpoints used by the Tayaqan Certificate Verification System. The API connects the frontend with the backend to support institution management, certificate registration, certificate verification, and employer access.

**Base URL (local development):**

```text
http://127.0.0.1:8000/
```

> Note: The routes below are a documentation template. Update the paths and request details to match the actual endpoints implemented in the Django backend.

## API Endpoints

### 1. Institution Management

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/institutions/` | Retrieve registered institutions. |
| POST | `/api/institutions/` | Register an institution, if permitted. |
| GET | `/api/institutions/{id}/` | Retrieve institution details. |

### 2. Certificate Management

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/certificates/` | Register or issue a certificate. |
| GET | `/api/certificates/{id}/` | Retrieve certificate details, subject to access permissions. |
| POST | `/api/certificates/verify/` | Verify a submitted certificate. |
| POST | `/api/certificates/{id}/revoke/` | Revoke a certificate, if supported and authorized. |

### 3. Certificate File Storage

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/certificates/upload/` | Upload a certificate file, if implemented. |

Certificate files may be stored using Storacha, while certificate hashes and verification records are managed through the appropriate blockchain integration.

### 4. Employer Verification

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/employer/verify/` | Allow an authorized employer to request certificate verification, if implemented. |

## Request and Response

Each endpoint should document:

- **HTTP method:** GET, POST, PUT, PATCH, or DELETE.
- **Request body:** Required fields and their data types.
- **Authentication:** Whether the request requires an authenticated user.
- **Permissions:** Which roles may perform the operation.
- **Response:** Expected successful response and possible error codes.

### Example: Certificate Verification

**Request**

```http
POST /api/certificates/verify/
Content-Type: application/json
```

Example request body:

```json
{
  "certificate_id": "CERT-12345"
}
```

Example successful response:

```json
{
  "verified": true,
  "message": "Certificate verification successful."
}
```

The request fields and response format above are illustrative. They must match the actual backend implementation.

## Error Responses

The API may return standard HTTP status codes, depending on the endpoint:

| Status Code | Meaning |
|---|---|
| 200 | Request successful. |
| 201 | Resource created successfully. |
| 400 | Invalid request data. |
| 401 | Authentication required. |
| 403 | Permission denied. |
| 404 | Resource not found. |
| 500 | Internal server error. |

## Implementation Notes

- All documented endpoints must correspond to routes defined in Django's URL configuration.
- Request validation and response serialization should follow the backend implementation.
- Certificate verification should use the actual blockchain and storage integration implemented in the project.
- Access permissions should reflect the roles of educational institutions, applicants, and employers.
