// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TayaqanCertificate
 * @notice Certificate authenticity verification system
 * @dev Supports both single and batch certificate verification
 */
contract TayaqanCertificate is Ownable {
    error AlreadyIssued();
    error NotFound();
    error AlreadyRevoked();

    struct Certificate {
        bytes32 applicantIdHash;
        uint64 issuedAt;
        bool revoked;
    }

    mapping(bytes32 => Certificate) public certByFileHash;

    event CertificateIssued(bytes32 indexed applicantIdHash, bytes32 indexed fileHash, uint64 issuedAt);
    event CertificateRevoked(bytes32 indexed fileHash, uint64 revokedAt);

    constructor(address initialOwner) Ownable(initialOwner) {}

    // ==================== Write Functions ====================

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

    // ==================== Read Functions ====================

    /**
     * @notice Get a single certificate by file hash
     * @dev More efficient than batch for single lookups
     * @param fileHash The keccak256 hash of the certificate file
     * @return Certificate struct (returns default values if not found)
     */
    function getCertificate(bytes32 fileHash) 
        external 
        view 
        returns (Certificate memory) 
    {
        return certByFileHash[fileHash];
    }

    /**
     * @notice Get multiple certificates in a single call
     * @dev Used for list views and batch verification
     * @param fileHashes Array of file hashes to verify
     * @return certificates Array of Certificate structs
     */
    function getCertificatesBatch(bytes32[] calldata fileHashes)
        external
        view
        returns (Certificate[] memory certificates)
    {
        certificates = new Certificate[](fileHashes.length);
        for (uint256 i = 0; i < fileHashes.length; i++) {
            certificates[i] = certByFileHash[fileHashes[i]];
        }
    }
}