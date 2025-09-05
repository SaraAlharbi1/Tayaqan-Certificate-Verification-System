// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * TayaqanCertificate
 * - Anchors certificate facts on-chain (no PII).
 * - Records which verifier-company may view which certificate.
 * - Files remain encrypted off-chain (IPFS); backend enforces access.
 */
contract TayaqanCertificate is Ownable {
    // Errors
    error InvalidFileHash();
    error AlreadyIssued();
    error NotFound();
    error AlreadyRevoked();
    error CertIsRevoked();      
    error InvalidVerifier();

    // Certificate record (keyed by fileHash)
    struct Certificate {
        bytes32 applicantIdHash; // hash of applicant ID (off-chain)
        uint64  issuedAt;        // issuance timestamp
        bool    revoked;         // certificate invalidation
    }

    // fileHash (keccak256 of plain bytes) -> Certificate
    mapping(bytes32 => Certificate) private certByFileHash;

    // approvals[fileHash][verifierIdHash] = true/false
    mapping(bytes32 => mapping(bytes32 => bool)) private approvals;

    // Events
    event CertificateIssued(bytes32 indexed applicantIdHash, bytes32 indexed fileHash, uint64 issuedAt);
    event CertificateRevoked(bytes32 indexed fileHash, uint64 revokedAt);
    event AccessApproved(
        bytes32 indexed fileHash,
        bytes32 indexed verifierIdHash,
        bytes32 indexed applicantIdHash,
        uint64  approvedAt
    );

    constructor(address initialOwner) Ownable(initialOwner) {
        require(initialOwner != address(0), "owner=0");
    }

    // --- Certificates ---

    function issueCertificate(bytes32 applicantIdHash, bytes32 fileHash) external onlyOwner {
        if (fileHash == bytes32(0)) revert InvalidFileHash();
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

    // --- Approvals ---

    function approveAccess(bytes32 fileHash, bytes32 verifierIdHash) external onlyOwner {
        Certificate memory c = certByFileHash[fileHash];
        if (c.issuedAt == 0) revert NotFound();
        if (c.revoked) revert CertIsRevoked();     // updated
        if (verifierIdHash == bytes32(0)) revert InvalidVerifier();

        approvals[fileHash][verifierIdHash] = true;
        emit AccessApproved(fileHash, verifierIdHash, c.applicantIdHash, uint64(block.timestamp));
    }

    function approveAccessBatch(bytes32[] calldata fileHashes, bytes32 verifierIdHash) external onlyOwner {
        if (verifierIdHash == bytes32(0)) revert InvalidVerifier();

        uint256 n = fileHashes.length;
        for (uint256 i = 0; i < n; i++) {
            bytes32 fh = fileHashes[i];
            Certificate memory c = certByFileHash[fh];
            if (c.issuedAt == 0) revert NotFound();
            if (c.revoked) revert CertIsRevoked();

            approvals[fh][verifierIdHash] = true;
            emit AccessApproved(fh, verifierIdHash, c.applicantIdHash, uint64(block.timestamp));
        }
    }

    function isApproved(bytes32 fileHash, bytes32 verifierIdHash) external view returns (bool ok) {
        Certificate memory c = certByFileHash[fileHash];
        if (c.issuedAt == 0 || c.revoked) return false;
        return approvals[fileHash][verifierIdHash];
    }
}
