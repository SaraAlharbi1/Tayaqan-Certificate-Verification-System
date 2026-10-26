# Tayaqan – Smart Contract Functions Documentation

## 1. Overview

Tayaqan uses Ethereum smart contracts to manage academic certificate records, verify certificate status, control employer access, and maintain institution registration information.

The project contains two main smart contracts:

- **CertificateRegistry:** Manages certificate issuance, verification, revocation, and employer access permissions.
- **InstitutionRegistry:** Registers institutions and stores their associated certificate contract addresses and institution wallet addresses.

Both contracts are written in Solidity version `^0.8.19`.

---

## 2. CertificateRegistry

### 2.1 Contract Description

The `CertificateRegistry` contract manages certificate records and employer access permissions. It stores certificate information on the blockchain and allows authorized users to perform specific operations.

### 2.2 State Variables and Data Structures

| Variable | Description |
|---|---|
| `institutionWallet` | Address authorized to issue and revoke certificates. |
| `adminWallet` | Address authorized to manage employer access. |
| `certificates` | Mapping that associates certificate hash strings with certificate records. |

#### Employer Structure

The `Employer` structure contains:

- `id`: The employer's identifier, stored as a `bytes32` value.
- `expiryDate`: The timestamp at which employer access expires. A value of `0` means no expiry.

#### Certificate Structure

The `Certificate` structure contains:

- `certificateHash`: The certificate's hash identifier, stored as a string.
- `applicantIdHash`: The applicant's identifier hash.
- `certificateType`: The type of certificate.
- `issueDate`: The certificate's issue date, represented as a Unix timestamp.
- `isRevoked`: Indicates whether the certificate has been revoked.
- `allowedEmployers`: An array of employers associated with the certificate's access permissions.

### 2.3 Constructor

#### `constructor(address _institutionWallet, address _adminWallet)`

**Purpose:** Initializes the contract with the institution and administrator wallet addresses.

**Parameters:**
- `_institutionWallet`: The institution wallet authorized to issue and revoke certificates.
- `_adminWallet`: The administrator wallet authorized to manage employer access.

**Validation:**
- The institution wallet must not be the zero address.
- The administrator wallet must not be the zero address.

**Access Control:** Executed once when the contract is deployed.

**State Changes:** Sets the initial values of `institutionWallet` and `adminWallet`.

### 2.4 Certificate Management Functions

#### `issueCertificate(string _certificateHash, bytes32 _applicantIdHash, string _certificateType, uint256 _issueDate)`

**Purpose:** Registers a new certificate on the blockchain.

**Parameters:**
- `_certificateHash`: Unique string identifier used to locate the certificate record.
- `_applicantIdHash`: Hashed identifier of the applicant.
- `_certificateType`: Type of certificate being issued.
- `_issueDate`: Certificate issue timestamp.

**Access Control:** Restricted to the institution wallet through the `onlyInstitution` modifier.

**Validation:**
- Rejects a certificate if a record with the same hash already exists.

**State Changes:**
- Stores the certificate information.
- Initializes `isRevoked` to `false`.

**Events:** Emits `CertificateIssued` with the certificate hash and applicant identifier hash.

**Return Value:** None.

#### `verifyCertificate(string _certificateHash)`

**Purpose:** Retrieves the stored status and basic information of a certificate.

**Parameters:**
- `_certificateHash`: Identifier of the certificate to verify.

**Access Control:** Publicly callable through an external function. No role restriction is applied.

**Validation:**
- Reverts if the certificate does not exist.

**Return Values:**
- `certificateType`: The certificate type.
- `issueDate`: The recorded issue timestamp.
- `isRevoked`: Whether the certificate has been revoked.
- `employerCount`: The number of employer entries in the certificate's access list.

**State Mutability:** `view`. The function reads blockchain state without modifying it.

**Events:** None.

#### `revokeCertificate(string _certificateHash)`

**Purpose:** Marks an existing certificate as revoked.

**Parameters:**
- `_certificateHash`: Identifier of the certificate to revoke.

**Access Control:** Restricted to the institution wallet through the `onlyInstitution` modifier.

**Validation:**
- Rejects the operation if the certificate does not exist.

**State Changes:** Sets the certificate's `isRevoked` value to `true`.

**Events:** Emits `CertificateRevoked` with the certificate hash.

**Return Value:** None.

### 2.5 Employer Access Management Functions

#### `addEmployerAccess(string _certificateHash, bytes32 _employerId, uint256 _expiryDate)`

**Purpose:** Grants an employer access permission for a specific certificate.

**Parameters:**
- `_certificateHash`: Identifier of the certificate.
- `_employerId`: Employer identifier.
- `_expiryDate`: Access expiry timestamp. A value of `0` means no expiry.

**Access Control:** Restricted to the administrator wallet through the `onlyAdmin` modifier.

**Validation:**
- The certificate must exist.
- The certificate must not be revoked.
- The employer must not already have an entry in the certificate's access list.

**State Changes:** Adds the employer identifier and expiry date to `allowedEmployers`.

**Events:** Emits `EmployerAccessGranted` with the certificate hash, employer identifier, expiry date, and address that granted access.

**Return Value:** None.

#### `removeEmployerAccess(string _certificateHash, bytes32 _employerId)`

**Purpose:** Removes an employer's access entry from a certificate.

**Parameters:**
- `_certificateHash`: Identifier of the certificate.
- `_employerId`: Identifier of the employer whose access should be removed.

**Access Control:** Restricted to the administrator wallet through the `onlyAdmin` modifier.

**Validation:**
- The certificate must exist.
- The specified employer must have an entry in the certificate's access list.

**State Changes:** Removes the matching employer entry. The implementation replaces the removed entry with the last array element before removing the last element, so the array order is not preserved.

**Events:** Emits `EmployerAccessRevoked` with the certificate hash, employer identifier, and address that revoked access.

**Return Value:** None.

#### `checkEmployerAccess(string _certificateHash, bytes32 _employerId)`

**Purpose:** Checks whether an employer currently has access permission for a certificate.

**Parameters:**
- `_certificateHash`: Identifier of the certificate.
- `_employerId`: Employer identifier to check.

**Access Control:** Publicly callable. No role restriction is applied.

**Return Values:**
- `hasAccess`: A Boolean indicating whether access is currently valid.
- `expiryDate`: The recorded expiry timestamp, or `0` if no matching employer entry is found or the certificate is missing or revoked.

**Validation and Logic:**
- Returns `(false, 0)` if the certificate does not exist or has been revoked.
- Searches the certificate's employer access list.
- Returns `(true, expiryDate)` if a matching employer has no expiry or the current block timestamp is less than or equal to the expiry timestamp.
- Returns `(false, expiryDate)` if the matching employer's access has expired.
- Returns `(false, 0)` if the employer has no matching entry.

**State Mutability:** `view`. The function does not modify blockchain state.

**Events:** None.

### 2.6 Access Control Modifiers

#### `onlyInstitution()`

Restricts a function to calls made by the address stored in `institutionWallet`.

**Used by:**
- `issueCertificate`
- `revokeCertificate`

Reverts with `"Only institution can call this"` when the caller is unauthorized.

#### `onlyAdmin()`

Restricts a function to calls made by the address stored in `adminWallet`.

**Used by:**
- `addEmployerAccess`
- `removeEmployerAccess`

Reverts with `"Only admin can call this"` when the caller is unauthorized.

### 2.7 Events

| Event | Description |
|---|---|
| `CertificateIssued` | Emitted when a certificate is issued. Includes the certificate hash and applicant identifier hash. |
| `CertificateRevoked` | Emitted when a certificate is revoked. Includes the certificate hash. |
| `EmployerAccessGranted` | Emitted when employer access is granted. Includes the certificate hash, employer identifier, expiry date, and granting address. |
| `EmployerAccessRevoked` | Emitted when employer access is removed. Includes the certificate hash, employer identifier, and revoking address. |

The certificate hash and applicant identifier hash in `CertificateIssued`, the certificate hash in `CertificateRevoked`, and the certificate hash and employer identifier in the employer access events are indexed.

---

## 3. InstitutionRegistry

### 3.1 Contract Description

The `InstitutionRegistry` contract stores institution registration information, including institution names, certificate contract addresses, institution wallet addresses, and activation status.

### 3.2 State Variables and Data Structures

| Variable | Description |
|---|---|
| `admin` | Address of the administrator who deploys the contract. |
| `institutions` | Mapping from institution ID strings to institution records. |

#### Institution Structure

The `Institution` structure contains:

- `name`: Name of the institution.
- `certificateContract`: Address of the institution's certificate registry contract.
- `institutionWallet`: Wallet address associated with the institution.
- `isActive`: Boolean indicating whether the institution is marked as active.

### 3.3 Constructor

#### `constructor()`

**Purpose:** Initializes the institution registry administrator.

**Access Control:** Executed once when the contract is deployed.

**State Changes:** Sets `admin` to `msg.sender`, the address that deploys the contract.

**Parameters:** None.

**Return Value:** None.

### 3.4 Institution Management Functions

#### `registerInstitution(string _institutionId, string _name, address _certificateContract, address _institutionWallet)`

**Purpose:** Registers an institution or replaces the stored information for an existing institution ID.

**Parameters:**
- `_institutionId`: Unique institution identifier used as the mapping key.
- `_name`: Institution name.
- `_certificateContract`: Address of the associated certificate contract.
- `_institutionWallet`: Institution wallet address.

**Access Control:** Restricted to the administrator through the `onlyAdmin` modifier.

**State Changes:**
- Stores the institution's name and contract address.
- Stores the institution wallet address.
- Sets `isActive` to `true`.

**Validation:** The function does not currently validate duplicate institution IDs or reject zero addresses. Registering an existing ID overwrites its stored record.

**Events:** Emits `InstitutionRegistered` with the institution ID, name, and certificate contract address.

**Return Value:** None.

#### `getInstitution(string _institutionId)`

**Purpose:** Retrieves the stored information for an institution.

**Parameters:**
- `_institutionId`: Identifier of the institution to retrieve.

**Access Control:** Publicly callable through an external function. No role restriction is applied.

**Return Values:**
1. Institution name (`string`).
2. Certificate contract address (`address`).
3. Institution wallet address (`address`).
4. Institution activation status (`bool`).

**State Mutability:** `view`. The function reads stored information without modifying the contract state.

**Events:** None.

**Note:** If the institution ID has not been registered, the function returns the default values for the corresponding fields.

### 3.5 Access Control Modifier

#### `onlyAdmin()`

Restricts access to functions that require the caller to be the address stored in `admin`.

**Used by:**
- `registerInstitution`

Reverts with `"Only admin"` when the caller is unauthorized.

### 3.6 Events

#### `InstitutionRegistered(string institutionId, string name, address certificateContract)`

**Purpose:** Records an event when an institution is registered or its record is updated.

**Parameters:**
- `institutionId`: Institution identifier.
- `name`: Institution name.
- `certificateContract`: Associated certificate contract address.

**Note:** The event does not declare any indexed parameters.

---

## 4. Function Access Control Summary

| Contract | Function | Authorized Caller |
|---|---|---|
| CertificateRegistry | `issueCertificate` | Institution wallet |
| CertificateRegistry | `verifyCertificate` | Any caller |
| CertificateRegistry | `revokeCertificate` | Institution wallet |
| CertificateRegistry | `addEmployerAccess` | Administrator wallet |
| CertificateRegistry | `removeEmployerAccess` | Administrator wallet |
| CertificateRegistry | `checkEmployerAccess` | Any caller |
| InstitutionRegistry | `registerInstitution` | Registry administrator |
| InstitutionRegistry | `getInstitution` | Any caller |

The constructor of `InstitutionRegistry` assigns the registry administrator to the deploying address. The constructor of `CertificateRegistry` receives its institution and administrator wallet addresses during deployment.

---

## 5. Important Implementation Notes

1. **Certificate hash handling:** The contract uses a string as the certificate mapping key. It does not independently calculate or validate a cryptographic hash.

2. **Certificate verification:** `verifyCertificate` returns certificate metadata and revocation status. It does not return the original certificate file or independently verify the contents of an off-chain file.

3. **Employer access:** `checkEmployerAccess` reports whether access is valid according to the on-chain record. It does not itself enforce access restrictions on Storacha or other off-chain storage.

4. **Access expiry:** An expiry date of `0` means no expiry. Otherwise, access remains valid while `block.timestamp <= expiryDate`.

5. **Institution activation:** `InstitutionRegistry` stores an `isActive` flag, but the current contract does not provide a function to deactivate or reactivate an institution.

6. **Access administration:** Employer access changes are controlled by `adminWallet`, while certificate issuance and revocation are controlled by `institutionWallet`.

7. **Revocation behavior:** The current implementation allows an existing certificate to be revoked more than once. The function does not contain a separate check to prevent repeated revocation.

8. **Registration validation:** `registerInstitution` overwrites an existing record when the same institution ID is used. It does not validate whether the supplied addresses are nonzero or whether the certificate contract is valid.

---

## 6. Summary

The two smart contracts provide the main on-chain functions for Tayaqan's institution and certificate management.

`InstitutionRegistry` manages institution records, while `CertificateRegistry` handles certificate issuance, verification, revocation, and employer access permissions. Together, they support the project's blockchain-based certificate verification workflow and its role-based access model.
