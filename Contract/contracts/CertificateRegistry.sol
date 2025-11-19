// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract CertificateRegistry {
    
    struct Certificate {
        string certificateHash;
        bytes32 applicantIdHash;
        string certificateType;
        uint256 issueDate;
        bool isRevoked;
    }
    
    address public institutionWallet;
    mapping(string => Certificate) public certificates;
    
    event CertificateIssued(string certificateHash, bytes32 applicantIdHash);
    event CertificateRevoked(string certificateHash);
    
    modifier onlyInstitution() {
        require(msg.sender == institutionWallet, "Only institution");
        _;
    }
    
    constructor(address _institutionWallet) {
        institutionWallet = _institutionWallet;
    }
    
    function issueCertificate(
        string memory _certificateHash,
        bytes32 _applicantIdHash,
        string memory _certificateType,
        uint256 _issueDate
    ) external onlyInstitution {
        certificates[_certificateHash] = Certificate({
            certificateHash: _certificateHash,
            applicantIdHash: _applicantIdHash,
            certificateType: _certificateType,
            issueDate: _issueDate,
            isRevoked: false
        });

        emit CertificateIssued(_certificateHash, _applicantIdHash);
    }
    
    function verifyCertificate(string memory _certificateHash)
        external
        view
        returns (string memory, uint256, bool)
    {
        Certificate memory cert = certificates[_certificateHash];
        return (cert.certificateType, cert.issueDate, cert.isRevoked);
    }
    
    function revokeCertificate(string memory _certificateHash) 
        external 
        onlyInstitution 
    {
        certificates[_certificateHash].isRevoked = true;
        emit CertificateRevoked(_certificateHash);
    }
}
