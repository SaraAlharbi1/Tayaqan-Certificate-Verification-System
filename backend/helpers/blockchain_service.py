import logging
from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware
from eth_account import Account
from django.conf import settings

logger = logging.getLogger(__name__)


class BlockchainService:
    def __init__(self, contract_address: str, private_key: str = None):
        """
        Initialize blockchain service.
        """
        self.rpc_url = settings.BLOCKCHAIN_RPC_URL
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))

        self.w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

        if not self.w3.is_connected():
            raise ConnectionError(f"Failed to connect to blockchain at {self.rpc_url}")

        self.contract_address = Web3.to_checksum_address(contract_address)
        self.contract = self._load_contract()

        self.signer_account = None
        if private_key:
            self.signer_account = Account.from_key(private_key)
            logger.info(f"Blockchain service initialized with signer: {self.signer_account.address}")
        else:
            logger.info("Blockchain service initialized (read-only)")

    def _load_contract(self):
        """Load contract ABI."""
        import json
        from pathlib import Path

        project_root = Path(__file__).parent.parent.parent
        abi_path = (
            project_root
            / "contract"
            / "artifacts"
            / "contracts"
            / "CertificateRegistry.sol"
            / "CertificateRegistry.json"
        )

        if not abi_path.exists():
            raise FileNotFoundError(f"ABI file not found at: {abi_path}")

        with open(abi_path, "r") as f:
            contract_data = json.load(f)
            abi = contract_data.get("abi", [])

        return self.w3.eth.contract(address=self.contract_address, abi=abi)

    def add_employer_access(self, file_hash: str, employer_id_hash: str, expiry_timestamp: int = 0) -> dict:
        """Add employer access on blockchain."""
        if not self.signer_account:
            return {"success": False, "error": "No signer account configured"}

        try:
            file_hash = file_hash if file_hash.startswith("0x") else f"0x{file_hash}"
            employer_id_hash = employer_id_hash if employer_id_hash.startswith("0x") else f"0x{employer_id_hash}"

            nonce = self.w3.eth.get_transaction_count(self.signer_account.address)

            transaction = self.contract.functions.addEmployerAccess(
                file_hash,
                Web3.to_bytes(hexstr=employer_id_hash),
                expiry_timestamp
            ).build_transaction({
                'from': self.signer_account.address,
                'nonce': nonce,
                'gas': 300000,
                'gasPrice': self.w3.eth.gas_price,
            })

            signed_txn = self.w3.eth.account.sign_transaction(
                transaction,
                private_key=self.signer_account.key
            )

            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.raw_transaction)
            tx_receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

            if tx_receipt.status == 1:
                return {"success": True, "tx_hash": tx_hash.hex(), "block_number": tx_receipt.blockNumber}
            else:
                return {"success": False, "error": "Transaction reverted", "tx_hash": tx_hash.hex()}

        except Exception as e:
            logger.error(f"Error adding employer access: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    def remove_employer_access(self, file_hash: str, employer_id_hash: str) -> dict:
        """Remove employer access."""
        if not self.signer_account:
            return {"success": False, "error": "No signer account configured"}

        try:
            file_hash = file_hash if file_hash.startswith("0x") else f"0x{file_hash}"
            employer_id_hash = employer_id_hash if employer_id_hash.startswith("0x") else f"0x{employer_id_hash}"

            nonce = self.w3.eth.get_transaction_count(self.signer_account.address)

            transaction = self.contract.functions.removeEmployerAccess(
                file_hash,
                Web3.to_bytes(hexstr=employer_id_hash)
            ).build_transaction({
                'from': self.signer_account.address,
                'nonce': nonce,
                'gas': 200000,
                'gasPrice': self.w3.eth.gas_price,
            })

            signed_txn = self.w3.eth.account.sign_transaction(
                transaction,
                private_key=self.signer_account.key
            )

            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.raw_transaction)
            tx_receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

            if tx_receipt.status == 1:
                return {"success": True, "tx_hash": tx_hash.hex(), "block_number": tx_receipt.blockNumber}
            else:
                return {"success": False, "error": "Transaction reverted", "tx_hash": tx_hash.hex()}

        except Exception as e:
            logger.error(f"Error removing employer access: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    def check_employer_access(self, file_hash: str, employer_id_hash: str) -> dict:
        """Check employer access."""
        try:
            file_hash = file_hash if file_hash.startswith("0x") else f"0x{file_hash}"
            employer_id_hash = employer_id_hash if employer_id_hash.startswith("0x") else f"0x{employer_id_hash}"

            result = self.contract.functions.checkEmployerAccess(
                file_hash,
                Web3.to_bytes(hexstr=employer_id_hash)
            ).call()

            return {"has_access": result[0], "expiry_date": result[1]}

        except Exception as e:
            logger.error(f"Error checking employer access: {e}", exc_info=True)
            return {"has_access": False, "expiry_date": 0}

    def verify_certificate(self, file_hash: str) -> dict:
        """
        Verify a single certificate on blockchain.
        
        verifyCertificate returns: (certificateType, issueDate, isRevoked, employerCount)
        
        Returns:
            {"exists": bool, "is_revoked": bool, "issue_date": int}
        """
        try:
            file_hash = file_hash if file_hash.startswith("0x") else f"0x{file_hash}"
            
            # ✅ FIXED: Correct field mapping for verifyCertificate
            # Returns: (certificateType, issueDate, isRevoked, employerCount)
            result = self.contract.functions.verifyCertificate(file_hash).call()
            
            return {
                "exists": len(result[0]) > 0,  # If certificateType is not empty
                "is_revoked": result[2],       # isRevoked (index 2)
                "issue_date": result[1]        # issueDate (index 1)
            }
            
        except Exception as e:
            logger.error(f"Error verifying certificate: {e}", exc_info=True)
            return {
                "exists": False,
                "is_revoked": False,
                "issue_date": 0
            }

    def verify_certificates_batch(self, file_hashes: list) -> list:
        """
        Verify multiple certificates on blockchain.
        
        Args:
            file_hashes: List of certificate file hashes
            
        Returns:
            List of verification results
        """
        results = []
        
        for file_hash in file_hashes:
            result = self.verify_certificate(file_hash)
            results.append({
                "file_hash": file_hash,
                "exists": result["exists"],
                "is_revoked": result["is_revoked"],
                "issue_date": result["issue_date"]
            })
        
        return results

    def get_certificate_details(self, file_hash: str) -> dict:
        """
        Get full certificate details from blockchain.
        
        Returns:
            {"exists": bool, "is_revoked": bool, "issue_date": int, "certificate_type": str}
        """
        try:
            file_hash = file_hash if file_hash.startswith("0x") else f"0x{file_hash}"
            
            # Use verifyCertificate: (certificateType, issueDate, isRevoked, employerCount)
            result = self.contract.functions.verifyCertificate(file_hash).call()
            
            return {
                "exists": len(result[0]) > 0,
                "certificate_type": result[0],  # certificateType
                "issue_date": result[1],        # issueDate
                "is_revoked": result[2],        # isRevoked
                "employer_count": result[3]     # employerCount
            }
            
        except Exception as e:
            logger.error(f"Error getting certificate details: {e}", exc_info=True)
            return {
                "exists": False,
                "certificate_type": "",
                "issue_date": 0,
                "is_revoked": False,
                "employer_count": 0
            }


def create_blockchain_service(contract_address: str, use_admin_wallet: bool = True) -> BlockchainService:
    """
    Factory function to create blockchain service.
    """
    private_key = None

    if use_admin_wallet:
        private_key = settings.ADMIN_PRIVATE_KEY
        if not private_key:
            logger.warning("ADMIN_PRIVATE_KEY not configured")

    return BlockchainService(contract_address, private_key)
