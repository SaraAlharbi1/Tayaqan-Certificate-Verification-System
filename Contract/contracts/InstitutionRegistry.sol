// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;
contract InstitutionRegistry {  
    struct Institution {
        string name;
        address certificateContract;
        address institutionWallet;
        bool isActive;
    }   
    address public admin;
    mapping(string => Institution) public institutions;  
    event InstitutionRegistered(string institutionId, string name, address certificateContract);
  
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }  
    constructor() {
        admin = msg.sender;
    }
    
    function registerInstitution(
        string memory _institutionId,
        string memory _name,
        address _certificateContract,
        address _institutionWallet
    ) external onlyAdmin {
        institutions[_institutionId] = Institution({
            name: _name,
            certificateContract: _certificateContract,
            institutionWallet: _institutionWallet,
            isActive: true
        });
        
        emit InstitutionRegistered(_institutionId, _name, _certificateContract);
    }
    
    function getInstitution(string memory _institutionId) 
        external view returns (string memory, address, address, bool) 
    {
        Institution memory inst = institutions[_institutionId];
        return (inst.name, inst.certificateContract, inst.institutionWallet, inst.isActive);
    }
}
