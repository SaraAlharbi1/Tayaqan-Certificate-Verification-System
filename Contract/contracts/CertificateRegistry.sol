// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;
contract CertificateRegistry {
    // ============ STATE VARIABLES ============  
    address public institutionWallet;
    address public adminWallet;   
    // ============ STRUCTS ============  
    struct Employer {
        bytes32 id;
        uint256 expiryDate;
    }
    struct Certificate {
        string certificateHash;
        bytes32 applicantIdHash;
        string certificateType;
        uint256 issueDate;
        bool isRevoked;
        Employer[] allowedEmployers;
    }  
    // ============ MAPPINGS ============  
    mapping(string => Certificate) public certificates;  


    // ============ EVENTS ============ 
    event CertificateIssued(
        string indexed certificateHash, 
        bytes32 indexed applicantIdHash
    ); 
    event CertificateRevoked(string indexed certificateHash);
    
    event EmployerAccessGranted(
        string indexed certificateHash,
        bytes32 indexed employerId,
        uint256 expiryDate,
        address grantedBy
    );
    
    event EmployerAccessRevoked(
        string indexed certificateHash,
        bytes32 indexed employerId,
        address revokedBy
    );
     modifier onlyInstitution() {
        require(
            msg.sender == institutionWallet,
            "Only institution can call this"
        );
        _;
    }
    
    modifier onlyAdmin() {
        require(
            msg.sender == adminWallet,
            "Only admin can call this"
        );
        _;
    }
    // ============ CONSTRUCTOR ============   
    constructor(address _institutionWallet, address _adminWallet) {
        require(_institutionWallet != address(0), "Invalid institution address");
        require(_adminWallet != address(0), "Invalid admin address");
        
        institutionWallet = _institutionWallet;
        adminWallet = _adminWallet;
    }
    // ============ CERTIFICATE MANAGEMENT ============
    
    function issueCertificate(
        string memory _certificateHash,
        bytes32 _applicantIdHash,
        string memory _certificateType,
        uint256 _issueDate
    ) external onlyInstitution {
        require(
            bytes(certificates[_certificateHash].certificateHash).length == 0,
            "Certificate already exists"
        );      
        Certificate storage newCert = certificates[_certificateHash];
        newCert.certificateHash = _certificateHash;
        newCert.applicantIdHash = _applicantIdHash;
        newCert.certificateType = _certificateType;
        newCert.issueDate = _issueDate;
        newCert.isRevoked = false;

        emit CertificateIssued(_certificateHash, _applicantIdHash);
    }
    
    function verifyCertificate(string memory _certificateHash)
        external
        view
        returns (
            string memory certificateType,
            uint256 issueDate,
            bool isRevoked,
            uint256 employerCount
        )
    {
        Certificate storage cert = certificates[_certificateHash];
        require(
            bytes(cert.certificateHash).length > 0,
            "Certificate does not exist"
        );  
        return (
            cert.certificateType,
            cert.issueDate,
            cert.isRevoked,
            cert.allowedEmployers.length
        );
    }
    
    function revokeCertificate(string memory _certificateHash) 
        external 
        onlyInstitution 
    {
        require(
            bytes(certificates[_certificateHash].certificateHash).length > 0,
            "Certificate does not exist"
        );      
        certificates[_certificateHash].isRevoked = true;
        emit CertificateRevoked(_certificateHash);
    }
    
    // ============ EMPLOYER ACCESS MANAGEMENT ============
    
    function addEmployerAccess(
        string memory _certificateHash,
        bytes32 _employerId,
        uint256 _expiryDate
    ) external onlyAdmin {
        Certificate storage cert = certificates[_certificateHash];
        
        require(
            bytes(cert.certificateHash).length > 0,
            "Certificate does not exist"
        );       
        require(!cert.isRevoked, "Certificate is revoked");    
        // Check if employer already has access
        for (uint i = 0; i < cert.allowedEmployers.length; i++) {
            require(
                cert.allowedEmployers[i].id != _employerId,
                "Employer already has access"
            );
        }     
        // Add employer
        cert.allowedEmployers.push(Employer({
            id: _employerId,
            expiryDate: _expiryDate
        }));
        
        emit EmployerAccessGranted(
            _certificateHash,
            _employerId,
            _expiryDate,
            msg.sender
        );
    }
    
    function removeEmployerAccess(
        string memory _certificateHash,
        bytes32 _employerId
    ) external onlyAdmin() {
        Certificate storage cert = certificates[_certificateHash];
        
        require(
            bytes(cert.certificateHash).length > 0,
            "Certificate does not exist"
        );
        
        // Find and remove employer
        bool found = false;
        for (uint i = 0; i < cert.allowedEmployers.length; i++) {
            if (cert.allowedEmployers[i].id == _employerId) {
                // Move last element to this position and pop
                cert.allowedEmployers[i] = cert.allowedEmployers[
                    cert.allowedEmployers.length - 1
                ];
                cert.allowedEmployers.pop();
                found = true;
                break;
            }
        }      
        require(found, "Employer does not have access");  
        emit EmployerAccessRevoked(_certificateHash, _employerId, msg.sender);
    }
    
    function checkEmployerAccess(
        string memory _certificateHash,
        bytes32 _employerId
    ) external view returns (bool hasAccess, uint256 expiryDate) {
        Certificate storage cert = certificates[_certificateHash];     
        // Certificate must exist and not be revoked
        if (bytes(cert.certificateHash).length == 0 || cert.isRevoked) {
            return (false, 0);
        }     
        // Check if employer is in the list
        for (uint i = 0; i < cert.allowedEmployers.length; i++) {
            if (cert.allowedEmployers[i].id == _employerId) {
                uint256 expiry = cert.allowedEmployers[i].expiryDate;
                
                // Check if access has expired (0 means no expiry)
                if (expiry == 0 || block.timestamp <= expiry) {
                    return (true, expiry);
                } else {
                    return (false, expiry);
                }
            }
        }     
        return (false, 0);
    }
}
