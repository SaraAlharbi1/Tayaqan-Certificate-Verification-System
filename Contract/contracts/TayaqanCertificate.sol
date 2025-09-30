// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TayaqanCertificate
 * @notice A blockchain-based certificate management system for issuing, managing, and controlling access to digital certificates.
 * @dev Manages on-chain authenticity while keeping encrypted files off-chain (IPFS).
 *
 * Key Features:
 * - Certificate issuance and revocation by authorized issuer
 * - Granular access control for certificate verifiers
 * - Privacy-preserving design (no PII stored on-chain)
 * - Batch operations for efficient gas usage
 * - Event logging for audit trails
 *
 * Architecture:
 * - On-chain: Certificate existence, validity, and access permissions
 * - Off-chain: Encrypted certificate files on IPFS
 * - Backend: Enforces access and serves decrypted content to authorized parties
 */
contract TayaqanCertificate is Ownable {
    /* ERRORS */
    /// @notice Thrown when attempting to issue a certificate that already exists
    error AlreadyIssued();
    /// @notice Thrown when trying to access a certificate that doesn't exist
    error NotFound();
    /// @notice Thrown when attempting to revoke an already revoked certificate
    error AlreadyRevoked();
    /// @notice Thrown when trying to approve access to a revoked certificate
    error CertIsRevoked();

    /* DATA STRUCTURES */

    /**
     * @notice Core certificate data structure
     * @param applicantIdHash Keccak256 hash of applicant's identifier
     * @param issuedAt Unix timestamp of certificate issuance (> 0 means exists)
     * @param revoked Boolean flag indicating if the certificate was revoked
     */
    struct Certificate {
        bytes32 applicantIdHash;
        uint64 issuedAt;
        bool   revoked;
    }

    /* STATE */

    /// @notice fileHash (keccak256 of file) → certificate data
    mapping(bytes32 => Certificate) private certByFileHash;

    /// @notice fileHash → verifierIdHash → approved
    mapping(bytes32 => mapping(bytes32 => bool)) private approvals;

    /* EVENTS */

    event CertificateIssued(bytes32 indexed applicantIdHash, bytes32 indexed fileHash, uint64 issuedAt);
    event CertificateRevoked(bytes32 indexed fileHash, uint64 revokedAt);
    event AccessApproved(
        bytes32 indexed fileHash,
        bytes32 indexed verifierIdHash,
        bytes32 indexed applicantIdHash,
        uint64  approvedAt
    );

    /* CONSTRUCTOR */

    constructor(address initialOwner) Ownable(initialOwner) {}

    /* CERTIFICATE MANAGEMENT */

    function issueCertificate(bytes32 applicantIdHash, bytes32 fileHash) external onlyOwner {
        if (certByFileHash[fileHash].issuedAt != 0) revert AlreadyIssued();

        certByFileHash[fileHash] = Certificate({
            applicantIdHash: applicantIdHash,
            issuedAt: uint64(block.timestamp),
            revoked: false
        });

        emit CertificateIssued(applicantIdHash, fileHash, uint64(block.timestamp));
    }

    function revokeCertificate(bytes32 fileHash) external onlyOwner {
        Certificate storage c = certByFileHash[fileHash];
        if (c.issuedAt == 0) revert NotFound();
        if (c.revoked) revert AlreadyRevoked();

        c.revoked = true;
        emit CertificateRevoked(fileHash, uint64(block.timestamp));
    }

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

    function approveAccess(bytes32 fileHash, bytes32 verifierIdHash) external onlyOwner {
        Certificate memory c = certByFileHash[fileHash];
        if (c.issuedAt == 0) revert NotFound();
        if (c.revoked) revert CertIsRevoked();

        approvals[fileHash][verifierIdHash] = true;
        emit AccessApproved(fileHash, verifierIdHash, c.applicantIdHash, uint64(block.timestamp));
    }

    /**
     * @notice Partial-success batch: skips bad entries, returns which failed.
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

    function isApproved(bytes32 fileHash, bytes32 verifierIdHash) external view returns (bool ok) {
        Certificate memory c = certByFileHash[fileHash];
        if (c.issuedAt == 0 || c.revoked) return false;
        return approvals[fileHash][verifierIdHash];
    }
}
