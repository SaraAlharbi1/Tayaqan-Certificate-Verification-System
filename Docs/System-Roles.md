# Tayaqan System Roles

## Overview

Tayaqan is a blockchain-based certificate verification system designed to provide secure certificate management and reliable verification. The system defines different user roles to control access to features and ensure that each user can perform only the actions permitted to them.

## 1. Institution

The Institution role represents authorized educational institutions responsible for issuing and managing certificates.

**Responsibilities:**
- Register and manage certificates for graduates.
- Submit certificate information for registration.
- Associate certificate records with the appropriate recipients.
- Use the system to support certificate authenticity verification.
- Manage certificate records according to the permissions granted to the institution.

**Access:** Institution-specific certificate management and issuance features, subject to authorization.

## 2. Applicant

The Applicant role represents students, graduates, or individuals who receive certificates through the system.

**Responsibilities:**
- Access their certificate information.
- View available certificate details.
- Share certificate information when applying for employment or further education.
- Provide certificate details or verification references when required.

**Access:** Personal certificate information and applicant-facing features, subject to the system's access controls.

## 3. Employer

The Employer role represents companies, recruiters, and organizations that need to validate applicants' certificates.

**Responsibilities:**
- Submit certificate information for verification.
- Check whether a certificate matches its registered record.
- Review verification results.
- Use verification results to support recruitment and credential assessment decisions.

**Access:** Certificate verification features and the information authorized for disclosure.

## 4. Role-Based Access Control

The system should enforce permissions according to each user's role.

| Function | Institution | Applicant | Employer |
|---|---|---|---|
| Issue certificates | Allowed, if authorized | No | No |
| Manage issued certificates | According to permissions | No | No |
| View personal certificate information | According to permissions | Allowed | Only when authorized |
| Request certificate verification | If supported | If supported | Allowed, if authorized |
| Review verification results | According to permissions | According to permissions | Allowed, if authorized |

These permissions describe the intended role model. The actual permissions must match the application's implemented authentication and authorization logic.

## 5. Blockchain and Certificate Integrity

Tayaqan uses blockchain technology to support certificate integrity and verification. Depending on the implemented smart contracts, authorized institutions can register certificate records, while verification requests can be checked against the registered blockchain data.

Blockchain records can help detect unauthorized changes to certificate data. However, the authenticity of a certificate also depends on the identity and authorization of the institution that originally issued it.

## 6. Security Principles

- **Authentication:** Identify users before granting access to protected features.
- **Authorization:** Restrict actions according to the user's role and permissions.
- **Data Privacy:** Limit access to personal and certificate information.
- **Integrity:** Use blockchain-based records or cryptographic hashes to support certificate verification.
- **Accountability:** Record relevant actions where audit logging is implemented.

## Conclusion

The Tayaqan System Roles define how institutions, applicants, and employers interact with the certificate management and verification platform. Separating responsibilities helps protect certificate records, control access to sensitive information, and support a trustworthy verification process.
