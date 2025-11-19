"""
Blockchain service for certificate verification and management.

Based on CertificateRegistry.sol contract:
- issueCertificate(certificateHash, applicantIdHash, certificateType, issueDate)
- verifyCertificate(certificateHash) → (certificateType, issueDate, isRevoked)
- revokeCertificate(certificateHash)
- getApplicantCertificates(applicantIdHash) → certificateHash[]
"""

import json
from typing import Dict, List, Optional, Tuple
from web3 import Web3
from eth_account import Account


class BlockchainService:
    """Service for interacting with CertificateRegistry smart contract."""

    def __init__(self, w3: Web3, contract_address: str, contract_abi: list, private_key: str):
        """
        Initialize blockchain service.
        
        Args:
            w3: Web3 instance
            contract_address: CertificateRegistry contract address
            contract_abi: Contract ABI
            private_key: Private key for signing transactions
        """
        self.w3 = w3
        self.contract = w3.eth.contract(
            address=Web3.to_checksum_address(contract_address),
            abi=contract_abi
        )
        self.account = Account.from_key(private_key)
        self.address = self.account.address

    def verify_certificate(self, certificate_hash: str) -> Dict:
        """
        Verify a certificate on blockchain.
        
        Calls: verifyCertificate(certificateHash)
        Returns: {
            "exists": bool,
            "certificate_type": str,
            "issue_date": int,
            "is_revoked": bool
        }
        """
        try:
            # Normalize hash
            cert_hash = self._normalize_hash(certificate_hash)
            
            # Call contract
            certificate_type, issue_date, is_revoked = self.contract.functions.verifyCertificate(
                cert_hash
            ).call()
            
            # Check if certificate exists (non-empty type means it exists)
            exists = len(certificate_type) > 0
            
            return {
                "file_hash": cert_hash,  # Use file_hash for consistency with API
                "exists": exists,
                "certificate_type": certificate_type,
                "issue_date": issue_date,
                "is_revoked": is_revoked,
            }
        except Exception as e:
            print(f"Error verifying certificate {certificate_hash}: {e}")
            return {
                "file_hash": self._normalize_hash(certificate_hash),  # Use file_hash for consistency
                "exists": False,
                "certificate_type": "",
                "issue_date": 0,
                "is_revoked": False,
            }

    def verify_certificates_batch(self, certificate_hashes: List[str]) -> List[Dict]:
        """
        Verify multiple certificates in batch.
        
        Returns: List of verification results
        """
        results = []
        for cert_hash in certificate_hashes:
            result = self.verify_certificate(cert_hash)
            results.append(result)
        return results

    def revoke_certificate(self, certificate_hash: str) -> Dict:
        """
        Revoke a certificate on blockchain.
        
        Calls: revokeCertificate(certificateHash)
        Requires: msg.sender == institutionWallet
        
        Returns: {
            "success": bool,
            "tx_hash": str,
            "block_number": int,
            "error": str (if failed)
        }
        """
        try:
            # Normalize hash
            cert_hash = self._normalize_hash(certificate_hash)
            
            # Build transaction
            nonce = self.w3.eth.get_transaction_count(self.address)
            
            tx = self.contract.functions.revokeCertificate(
                cert_hash
            ).build_transaction({
                'from': self.address,
                'nonce': nonce,
                'gas': 200000,
                'gasPrice': self.w3.eth.gas_price,
            })
            
            # Sign transaction
            signed_tx = self.w3.eth.account.sign_transaction(tx, self.account.key)
            
            # Send transaction - ✅ FIXED: Use raw_transaction instead of rawTransaction
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
            
            # Wait for receipt
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            
            if receipt.status == 1:
                return {
                    "success": True,
                    "tx_hash": tx_hash.hex(),
                    "block_number": receipt.blockNumber,
                }
            else:
                return {
                    "success": False,
                    "error": "Transaction failed",
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
            }

    def get_applicant_certificates(self, applicant_id_hash: str) -> List[str]:
        """
        Get all certificate hashes for an applicant.
        
        Calls: getApplicantCertificates(applicantIdHash)
        Returns: List of certificate hashes
        """
        try:
            # Normalize hash (bytes32)
            if isinstance(applicant_id_hash, str):
                if applicant_id_hash.startswith('0x'):
                    applicant_hash = applicant_id_hash
                else:
                    applicant_hash = '0x' + applicant_id_hash
            else:
                applicant_hash = applicant_id_hash
            
            # Call contract
            cert_hashes = self.contract.functions.getApplicantCertificates(
                Web3.to_bytes(hexstr=applicant_hash)
            ).call()
            
            return cert_hashes
            
        except Exception as e:
            print(f"Error getting applicant certificates: {e}")
            return []

    def _normalize_hash(self, hash_value: str) -> str:
        """Normalize hash to 0x-prefixed lowercase string."""
        if not hash_value:
            return ""
        hash_value = hash_value.strip().lower()
        if not hash_value.startswith("0x"):
            hash_value = "0x" + hash_value
        return hash_value


def create_blockchain_service(
    contract_address: str,
    w3: Optional[Web3] = None,
    private_key: Optional[str] = None
) -> Optional[BlockchainService]:
    """
    Factory function to create BlockchainService instance.
    
    Args:
        contract_address: CertificateRegistry contract address
        w3: Optional Web3 instance (will use default if not provided)
        private_key: Optional private key (will use default if not provided)
    
    Returns:
        BlockchainService instance or None if not configured
    """
    from helpers.web3_client import w3 as default_w3, ADMIN_PRIVATE_KEY
    from helpers.contracts import CertificateRegistry_abi
    
    # Use provided or default Web3
    web3_instance = w3 or default_w3
    if not web3_instance:
        print("❌ [blockchain_service] Web3 not configured")
        return None
    
    # Use provided or default private key
    key = private_key or ADMIN_PRIVATE_KEY
    if not key:
        print("❌ [blockchain_service] Private key not configured")
        return None
    
    # Check ABI
    if not CertificateRegistry_abi:
        print("❌ [blockchain_service] CertificateRegistry ABI not loaded")
        return None
    
    # Create service
    try:
        service = BlockchainService(
            w3=web3_instance,
            contract_address=contract_address,
            contract_abi=CertificateRegistry_abi,
            private_key=key
        )
        print(f"✅ [blockchain_service] Service created for contract: {contract_address}")
        return service
    except Exception as e:
        print(f"❌ [blockchain_service] Failed to create service: {e}")
        return None


# Convenience functions for common operations

def verify_certificate(contract_address: str, certificate_hash: str) -> Dict:
    """Verify a single certificate."""
    service = create_blockchain_service(contract_address)
    if not service:
        return {"exists": False, "error": "Blockchain service not available"}
    return service.verify_certificate(certificate_hash)


def verify_certificates_batch(contract_address: str, certificate_hashes: List[str]) -> List[Dict]:
    """Verify multiple certificates."""
    service = create_blockchain_service(contract_address)
    if not service:
        return [{"exists": False, "error": "Blockchain service not available"} for _ in certificate_hashes]
    return service.verify_certificates_batch(certificate_hashes)


def revoke_certificate(contract_address: str, certificate_hash: str) -> Dict:
    """Revoke a certificate."""
    service = create_blockchain_service(contract_address)
    if not service:
        return {"success": False, "error": "Blockchain service not available"}
    return service.revoke_certificate(certificate_hash)