"""Domain events and blockchain auto-deployment handlers."""

import logging
from web3 import Web3
from django.utils import timezone

logger = logging.getLogger(__name__)


# ============================================================
# Observer Pattern
# ============================================================

_observers = {
    "employer_approved": [],
    "institution_approved": [],
}


def register(event_name: str, handler):
    """Register event handler."""
    if event_name in _observers:
        _observers[event_name].append(handler)


def emit(event_name: str, payload):
    """Emit event to all registered handlers."""
    for handler in _observers.get(event_name, []):
        try:
            handler(payload)
        except Exception as e:
            logger.error(f"Handler {handler.__name__} failed: {e}")


def employer_approved(employer):
    """Trigger employer approval event."""
    emit("employer_approved", employer)


def institution_approved(institution):
    """Trigger institution approval event."""
    emit("institution_approved", institution)


# ============================================================
# Blockchain Deployment - FIXED FOR WINDOWS
# ============================================================

def _deploy_certificate_registry_and_register(institution_wallet: str, institution_id: str, institution_name: str):
    """
    Deploy CertificateRegistry, then register in InstitutionRegistry.
    
    Steps:
    1. Deploy CertificateRegistry contract
    2. Register in InstitutionRegistry with the deployed address
    
    Returns: (certificate_registry_address, success)
    """
    try:
        from helpers.web3_client import w3, ADMIN_ADDRESS, ADMIN_PRIVATE_KEY, INSTITUTION_REGISTRY_ADDRESS
        from helpers.contracts import CertificateRegistry_abi, InstitutionRegistry_abi
        from eth_account import Account
        import json
        import os
        
        if not all([w3, ADMIN_ADDRESS, ADMIN_PRIVATE_KEY, INSTITUTION_REGISTRY_ADDRESS]):
            logger.error("❌ Web3 or InstitutionRegistry not configured")
            return None, False
        
        logger.info(f"🏗️  Deploying CertificateRegistry for: {institution_wallet}")
        
        deployer = Account.from_key(ADMIN_PRIVATE_KEY)
        
        # Load CertificateRegistry bytecode - FIXED PATH FOR WINDOWS
        # Get the project root (go up from backend/api/accounts to project root)
        current_dir = os.path.dirname(os.path.abspath(__file__))  # backend/api/accounts
        backend_dir = os.path.dirname(os.path.dirname(current_dir))  # backend
        project_root = os.path.dirname(backend_dir)  # project root
        
        artifacts_path = os.path.join(
            project_root,
            'contract', 
            'artifacts',
            'contracts',
            'CertificateRegistry.sol',
            'CertificateRegistry.json'
        )
        
        logger.info(f"📂 Looking for artifact at: {artifacts_path}")
        
        if not os.path.exists(artifacts_path):
            logger.error(f"❌ Artifact not found: {artifacts_path}")
            logger.error(f"   Current dir: {current_dir}")
            logger.error(f"   Project root: {project_root}")
            return None, False
        
        with open(artifacts_path, 'r', encoding='utf-8') as f:
            artifact = json.load(f)
            bytecode = artifact['bytecode']
        
        logger.info(f"✅ Loaded bytecode ({len(bytecode)} chars)")
        
        # ============================================================
        # STEP 1: Deploy CertificateRegistry
        # ============================================================
        
        CertificateRegistry = w3.eth.contract(
            abi=CertificateRegistry_abi,
            bytecode=bytecode
        )
        
        nonce = w3.eth.get_transaction_count(deployer.address)
        
        deploy_tx = CertificateRegistry.constructor(
            Web3.to_checksum_address(institution_wallet)
        ).build_transaction({
            'from': deployer.address,
            'nonce': nonce,
            'gas': 3000000,
            'gasPrice': w3.eth.gas_price,
        })
        
        signed = w3.eth.account.sign_transaction(deploy_tx, ADMIN_PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        
        logger.info(f"📤 Deploying CertificateRegistry: {tx_hash.hex()}")
        
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        
        if receipt.status != 1:
            logger.error("❌ CertificateRegistry deployment failed")
            return None, False
        
        cert_registry_address = receipt.contractAddress
        logger.info(f"✅ CertificateRegistry deployed at: {cert_registry_address}")
        logger.info(f"   Block: {receipt.blockNumber}")
        
        # ============================================================
        # STEP 2: Register in InstitutionRegistry
        # ============================================================
        
        registry_contract = w3.eth.contract(
            address=INSTITUTION_REGISTRY_ADDRESS,
            abi=InstitutionRegistry_abi
        )
        
        nonce = w3.eth.get_transaction_count(deployer.address)
        
        register_tx = registry_contract.functions.registerInstitution(
            institution_id,
            institution_name,
            Web3.to_checksum_address(cert_registry_address),
            Web3.to_checksum_address(institution_wallet)
        ).build_transaction({
            'from': deployer.address,
            'nonce': nonce,
            'gas': 500000,
            'gasPrice': w3.eth.gas_price,
        })
        
        signed = w3.eth.account.sign_transaction(register_tx, ADMIN_PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        
        logger.info(f"📤 Registering in InstitutionRegistry: {tx_hash.hex()}")
        
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        
        if receipt.status != 1:
            logger.error("❌ Institution registration failed")
            return cert_registry_address, False  # Contract deployed but not registered
        
        logger.info(f"✅ Institution registered in InstitutionRegistry")
        logger.info(f"   Block: {receipt.blockNumber}")
        
        return cert_registry_address, True
        
    except Exception as e:
        logger.error(f"❌ Deployment failed: {e}", exc_info=True)
        return None, False


# ============================================================
# Institution Approval Handler
# ============================================================

def _handle_institution_approved(institution):
    """
    Auto-deploy CertificateRegistry on institution approval.
    
    Steps:
    1. Generate institution_id
    2. Deploy CertificateRegistry
    3. Register in InstitutionRegistry
    4. Save to database
    """
    from .models import Institution
    
    logger.info("=" * 60)
    logger.info(f"🏛️  Processing approval: {institution.institution_name}")
    logger.info("=" * 60)
    
    try:
        # Step 1: Generate institution ID
        if not institution.institution_id:
            institution.institution_id = institution.generate_institution_id()
            institution.save(update_fields=['institution_id'])
            logger.info(f"✅ Generated ID: {institution.institution_id}")
        
        # Step 2 & 3: Deploy and Register
        contract_address, success = _deploy_certificate_registry_and_register(
            institution.wallet_address,
            institution.institution_id,
            institution.institution_name
        )
        
        if not success or not contract_address:
            raise Exception("Contract deployment or registration failed")
        
        # Step 4: Save to database
        institution.contract_address = contract_address
        institution.deployed_at = timezone.now()
        institution.registered_in_registry = success
        institution.save(update_fields=[
            'contract_address',
            'deployed_at',
            'registered_in_registry'
        ])
        
        logger.info("=" * 60)
        logger.info("✅ Institution setup complete!")
        logger.info(f"   ID: {institution.institution_id}")
        logger.info(f"   Contract: {contract_address}")
        logger.info(f"   Registered: {success}")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error("=" * 60)
        logger.error(f"❌ Setup failed: {e}")
        logger.error("=" * 60)
        
        # Revert status on failure
        institution.status = Institution.Status.PENDING
        institution.save(update_fields=['status'])
        
        # Re-raise to make error visible
        raise


# Register handler
register("institution_approved", _handle_institution_approved)