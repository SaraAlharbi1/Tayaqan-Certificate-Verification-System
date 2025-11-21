# backend/api/blockchain/blockchain_service.py

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
        
        Args:
            contract_address: The deployed contract address
            private_key: Private key for signing transactions (optional)
        """
        self.rpc_url = settings.BLOCKCHAIN_RPC_URL
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        
        # Add PoA middleware for Hardhat/Ganache
        self.w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
        
        if not self.w3.is_connected():
            raise ConnectionError(f"Failed to connect to blockchain at {self.rpc_url}")
        
        self.contract_address = Web3.to_checksum_address(contract_address)
        self.contract = self._load_contract()
        
        # Setup signer if private key provided
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
        
        abi_path = Path(__file__).parent / "CertificateRegistry.json"
        
        with open(abi_path, "r") as f:
            contract_data = json.load(f)
            abi = contract_data.get("abi", [])
        
        return self.w3.eth.contract(address=self.contract_address, abi=abi)

    def add_employer_access(
        self,
        file_hash: str,
        employer_id_hash: str,
        expiry_timestamp: int = 0
    ) -> dict:
        """
        Add employer access on blockchain.
        
        Args:
            file_hash: Certificate file hash
            employer_id_hash: Employer ID hash
            expiry_timestamp: Expiry timestamp (0 = no expiry)
            
        Returns:
            {"success": bool, "tx_hash": str, "error": str}
        """
        if not self.signer_account:
            return {"success": False, "error": "No signer account configured"}
        
        try:
            # Normalize hashes
            file_hash = file_hash if file_hash.startswith("0x") else f"0x{file_hash}"
            employer_id_hash = employer_id_hash if employer_id_hash.startswith("0x") else f"0x{employer_id_hash}"
            
            # Get nonce
            nonce = self.w3.eth.get_transaction_count(self.signer_account.address)
            
            # Build transaction
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
            
            # Sign and send
            signed_txn = self.w3.eth.account.sign_transaction(
                transaction,
                private_key=self.signer_account.key
            )
            
            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.raw_transaction)
            tx_receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            
            if tx_receipt.status == 1:
                logger.info(f"✓ Employer access added: {tx_hash.hex()}")
                return {
                    "success": True,
                    "tx_hash": tx_hash.hex(),
                    "block_number": tx_receipt.blockNumber
                }
            else:
                logger.error(f"✗ Transaction failed: {tx_hash.hex()}")
                return {
                    "success": False,
                    "error": "Transaction reverted",
                    "tx_hash": tx_hash.hex()
                }
                
        except Exception as e:
            logger.error(f"✗ Error adding employer access: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    def remove_employer_access(
        self,
        file_hash: str,
        employer_id_hash: str
    ) -> dict:
        """Remove employer access from blockchain."""
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
                logger.info(f"✓ Employer access removed: {tx_hash.hex()}")
                return {
                    "success": True,
                    "tx_hash": tx_hash.hex(),
                    "block_number": tx_receipt.blockNumber
                }
            else:
                return {
                    "success": False,
                    "error": "Transaction reverted",
                    "tx_hash": tx_hash.hex()
                }
                
        except Exception as e:
            logger.error(f"✗ Error removing employer access: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    def check_employer_access(
        self,
        file_hash: str,
        employer_id_hash: str
    ) -> dict:
        """
        Check if employer has access on blockchain.
        
        Returns:
            {"has_access": bool, "expiry_date": int}
        """
        try:
            file_hash = file_hash if file_hash.startswith("0x") else f"0x{file_hash}"
            employer_id_hash = employer_id_hash if employer_id_hash.startswith("0x") else f"0x{employer_id_hash}"
            
            # Call smart contract (read-only)
            result = self.contract.functions.checkEmployerAccess(
                file_hash,
                Web3.to_bytes(hexstr=employer_id_hash)
            ).call()
            
            has_access = result[0]
            expiry_timestamp = result[1]
            
            logger.info(
                f"Blockchain check: fileHash={file_hash[:10]}..., "
                f"hasAccess={has_access}, expiry={expiry_timestamp}"
            )
            
            return {
                "has_access": has_access,
                "expiry_date": expiry_timestamp
            }
            
        except Exception as e:
            logger.error(f"Error checking employer access: {e}", exc_info=True)
            return {
                "has_access": False,
                "expiry_date": 0
            }


def create_blockchain_service(contract_address: str, use_admin_wallet: bool = True) -> BlockchainService:
    """
    Factory function to create blockchain service.
    
    Args:
        contract_address: Contract address
        use_admin_wallet: Use admin private key for signing
        
    Returns:
        BlockchainService instance
    """
    private_key = None
    
    if use_admin_wallet:
        private_key = settings.ADMIN_PRIVATE_KEY
        if not private_key:
            logger.warning("ADMIN_PRIVATE_KEY not configured")
    
    return BlockchainService(contract_address, private_key)