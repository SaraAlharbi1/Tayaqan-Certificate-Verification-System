// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Access control: Only Tayaqan (contract owner) can issue/revoke/approve
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TayaqanCertificate
 * @author Tayaqan Development Team
 * @notice A blockchain-based certificate management system for issuing, managing, and controlling access to digital certificates
 * @dev This contract manages certificate authenticity on-chain while keeping sensitive data encrypted off-chain (IPFS)
 *
 * Key Features:
 * - Certificate issuance and revocation by authorized issuer
 * - Granular access control for certificate verifiers
 * - Privacy-preserving design (no PII stored on-chain)
 * - Batch operations for efficient gas usage
 * - Event logging for comprehensive audit trails
 *
 * Architecture:
 * - On-chain: Certificate existence, validity, and access permissions
 * - Off-chain: Encrypted certificate files stored on IPFS
 * - Backend: Enforces access control and serves decrypted content to authorized parties
 */
contract TayaqanCertificate is Ownable {
    /* ERRORS */

    // @notice Thrown when attempting to issue a certificate that already exists
    error AlreadyIssued();
    // @notice Thrown when trying to access a certificate that doesn't exist
    error NotFound();
    // @notice Thrown when attempting to revoke an already revoked certificate
    error AlreadyRevoked();
    // @notice Thrown when trying to approve access to a revoked certificate
    error CertIsRevoked();

    /* DATA STRUCTURES */

    /**
     * @notice Core certificate data structure
     * @dev Contains minimal on-chain data for privacy and gas efficiency
     * @param applicantIdHash Keccak256 hash of applicant's identifier (maintains privacy)
     * @param issuedAt Unix timestamp of certificate issuance (> 0 means certificate exists)
     * @param revoked Boolean flag indicating if certificate has been invalidated
     */
    struct Certificate {
        bytes32 applicantIdHash; // hash of applicant ID (computed off-chain)
        uint64 issuedAt;         // issuance timestamp (>0 => exists)
        bool   revoked;          // certificate invalidation status
    }

    /* STATE VARIABLES */

    /**
     * @notice Maps certificate file hash to certificate data
     * @dev fileHash is keccak256 of the certificate file content (computed off-chain)
     */
    mapping(bytes32 => Certificate) private certByFileHash;

    /**
     * @notice Two-level mapping for access control: fileHash -> verifierIdHash -> approved
     * @dev Allows granular control over which verifiers can access specific certificates
     */
    mapping(bytes32 => mapping(bytes32 => bool)) private approvals;

    /* EVENTS */

    /**
     * @notice Emitted when a new certificate is issued
     * @param applicantIdHash Hash of the certificate holder's identifier
     * @param fileHash Hash of the certificate file content
     * @param issuedAt Timestamp of issuance
     */
    event CertificateIssued(
        bytes32 indexed applicantIdHash,
        bytes32 indexed fileHash,
        uint64 issuedAt
    );

    /**
     * @notice Emitted when a certificate is revoked
     * @param fileHash Hash of the revoked certificate file
     * @param revokedAt Timestamp of revocation
     */
    event CertificateRevoked(
        bytes32 indexed fileHash,
        uint64 revokedAt
    );

    /**
     * @notice Emitted when access is granted to a verifier for a specific certificate
     * @param fileHash Hash of the certificate file
     * @param verifierIdHash Hash of the verifier's identifier
     * @param applicantIdHash Hash of the certificate holder's identifier
     * @param approvedAt Timestamp of access approval
     */
    event AccessApproved(
        bytes32 indexed fileHash,
        bytes32 indexed verifierIdHash,
        bytes32 indexed applicantIdHash,
        uint64  approvedAt
    );

    /* CONSTRUCTOR */

    /**
     * @notice Initializes the contract and sets the contract owner
     * @dev Owner address is passed as a parameter during deployment
     * @param initialOwner Address that will own the contract and have admin privileges
     */
    constructor(address initialOwner) Ownable(initialOwner) {}

    /* CERTIFICATE MANAGEMENT */

    /**
     * @notice Issues a new certificate
     * @dev Only the contract owner (Tayaqan) can issue certificates.
     *      Existence is keyed by fileHash via issuedAt sentinel.
     * @param applicantIdHash Keccak256 hash of the applicant's identifier
     * @param fileHash Keccak256 hash of the certificate file content
     *
     * Requirements:
     * - Caller must be the contract owner
     * - Certificate with this fileHash must not already exist
     *
     * Emits: CertificateIssued
     */
    function issueCertificate(bytes32 applicantIdHash, bytes32 fileHash)
        external
        onlyOwner
    {
        if (certByFileHash[fileHash].issuedAt != 0) revert AlreadyIssued();

        certByFileHash[fileHash] = Certificate({
            applicantIdHash: applicantIdHash,
            issuedAt: uint64(block.timestamp),
            revoked: false
        });

        emit CertificateIssued(applicantIdHash, fileHash, uint64(block.timestamp));
    }

    /**
     * @notice Revokes an existing certificate, making it invalid
     * @dev Only the contract owner can revoke certificates. Revocation is permanent.
     * @param fileHash Hash of the certificate file to revoke
     *
     * Requirements:
     * - Caller must be the contract owner
     * - Certificate must exist
     * - Certificate must not already be revoked
     *
     * Emits: CertificateRevoked
     */
    function revokeCertificate(bytes32 fileHash)
        external
        onlyOwner
    {
        Certificate storage c = certByFileHash[fileHash];

        if (c.issuedAt == 0) revert NotFound();
        if (c.revoked) revert AlreadyRevoked();

        c.revoked = true;

        emit CertificateRevoked(fileHash, uint64(block.timestamp));
    }

    /**
     * @notice Retrieves certificate information
     * @dev Public read function - anyone can verify certificate existence and status
     * @param fileHash Hash of the certificate file to query
     * @return applicantIdHash Hash of the certificate holder's identifier
     * @return issuedAt Timestamp when the certificate was issued
     * @return revoked Boolean indicating if the certificate has been revoked
     *
     * Requirements:
     * - Certificate must exist
     */
    function getCertificate(bytes32 fileHash)
        external
        view
        returns (bytes32 applicantIdHash, uint64 issuedAt, bool revoked)
    {
        Certificate memory c = certByFileHash[fileHash];

        if (c.issuedAt == 0) revert NotFound();

        return (c.applicantIdHash, c.issuedAt, c.revoked);
    }

    /* ACCESS CONTROL */

    /**
     * @notice Grants access to a specific verifier for a single certificate
     * @dev Only the contract owner can approve access. Used for individual certificate access grants.
     * @param fileHash Hash of the certificate file
     * @param verifierIdHash Hash of the verifier's identifier (company ID hash)
     *
     * Requirements:
     * - Caller must be the contract owner
     * - Certificate must exist
     * - Certificate must not be revoked
     *
     * Emits: AccessApproved
     */
    function approveAccess(bytes32 fileHash, bytes32 verifierIdHash)
        external
        onlyOwner
    {
        Certificate memory c = certByFileHash[fileHash];

        if (c.issuedAt == 0) revert NotFound();
        if (c.revoked) revert CertIsRevoked();

        approvals[fileHash][verifierIdHash] = true;

        emit AccessApproved(fileHash, verifierIdHash, c.applicantIdHash, uint64(block.timestamp));
    }

    /**
     * @notice Grants access to a verifier for multiple certificates in a single transaction
     * @dev Implements partial success pattern - continues processing even if some certificates fail
     * @param fileHashes Array of certificate file hashes to process
     * @param verifierIdHash Hash of the verifier's identifier
     * @return failed Array of file hashes that could not be processed (non-existent or revoked)
     *
     * Requirements:
     * - Caller must be the contract owner
     *
     * Behavior:
     * - Skips non-existent or revoked certificates (adds to failed array)
     * - Skips already-approved certificates silently (not marked as failed)
     * - Continues processing remaining certificates
     * - Returns array of failed file hashes for client handling
     *
     * Emits: AccessApproved event for each successful approval
     */
    function approveAccessBatch(bytes32[] calldata fileHashes, bytes32 verifierIdHash)
        external
        onlyOwner
        returns (bytes32[] memory failed)
    {
        uint256 n = fileHashes.length;
        bytes32[] memory temp = new bytes32[](n);
        uint256 failedCount = 0;

        for (uint256 i = 0; i < n; i++) {
            bytes32 fh = fileHashes[i];
            Certificate memory c = certByFileHash[fh];

            if (c.issuedAt == 0 || c.revoked) {
                temp[failedCount++] = fh;
                continue;
            }

            approvals[fh][verifierIdHash] = true;
            emit AccessApproved(fh, verifierIdHash, c.applicantIdHash, uint64(block.timestamp));
        }

        failed = new bytes32[](failedCount);
        for (uint256 j = 0; j < failedCount; j++) {
            failed[j] = temp[j];
        }
    }

    /**
     * @notice Checks if a verifier has access to view a specific certificate
     * @dev Used by backend services to enforce access control before serving certificate content
     * @param fileHash Hash of the certificate file
     * @param verifierIdHash Hash of the verifier's identifier
     * @return ok True if verifier has access and certificate is valid, false otherwise
     *
     * Returns false if:
     * - Certificate doesn't exist
     * - Certificate is revoked
     * - Verifier doesn't have approval for this certificate
     */
    function isApproved(bytes32 fileHash, bytes32 verifierIdHash)
        external
        view
        returns (bool ok)
    {
        Certificate memory c = certByFileHash[fileHash];

        if (c.issuedAt == 0 || c.revoked) return false;

        return approvals[fileHash][verifierIdHash];
    }
}