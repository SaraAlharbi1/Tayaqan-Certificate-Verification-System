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
    if event_name in _observers:
        _observers[event_name].append(handler)


def emit(event_name: str, payload):
    for handler in _observers.get(event_name, []):
        try:
            handler(payload)
        except Exception as e:
            logger.error(f"Handler {handler.__name__} failed: {e}")


def employer_approved(employer):
    emit("employer_approved", employer)


def institution_approved(institution):
    emit("institution_approved", institution)


# ============================================================
# Blockchain Deployment (FULLY FIXED INDENTATION)
# ============================================================

def _deploy_certificate_registry_and_register(institution_wallet: str, institution_id: str, institution_name: str):
    try:
        from helpers.web3_client import w3, ADMIN_ADDRESS, ADMIN_PRIVATE_KEY, INSTITUTION_REGISTRY_ADDRESS
        from helpers.contracts import CertificateRegistry_abi, InstitutionRegistry_abi
        from eth_account import Account
        import json
        import os

        if not all([w3, ADMIN_ADDRESS, ADMIN_PRIVATE_KEY, INSTITUTION_REGISTRY_ADDRESS]):
            logger.error("❌ Web3 or InstitutionRegistry not configured")
            return None, False

        logger.info(f"🏗️ Deploying CertificateRegistry for: {institution_wallet}")

        deployer = Account.from_key(ADMIN_PRIVATE_KEY)

        # -------------------------------------------
        # Locate Artifact
        # -------------------------------------------
        current_dir = os.path.dirname(os.path.abspath(__file__))     # backend/api/accounts
        backend_dir = os.path.dirname(os.path.dirname(current_dir))  # backend
        project_root = os.path.dirname(backend_dir)                  # project root

        artifacts_path = os.path.join(
            project_root,
            "contract",
            "artifacts",
            "contracts",
            "CertificateRegistry.sol",
            "CertificateRegistry.json"
        )

        logger.info(f"📂 Looking for artifact at: {artifacts_path}")

        if not os.path.exists(artifacts_path):
            logger.error(f"❌ Artifact not found!")
            return None, False

        with open(artifacts_path, "r", encoding="utf-8") as f:
            artifact = json.load(f)
            bytecode = artifact["bytecode"]

        logger.info("✅ Loaded bytecode")

        # -------------------------------------------
        # STEP 1 — Deploy CertificateRegistry
        # -------------------------------------------

        CertificateRegistry = w3.eth.contract(
            abi=CertificateRegistry_abi,
            bytecode=bytecode
        )

        nonce = w3.eth.get_transaction_count(deployer.address)

        deploy_tx = CertificateRegistry.constructor(
            Web3.to_checksum_address(institution_wallet),
            ADMIN_ADDRESS
        ).build_transaction({
            "from": deployer.address,
            "nonce": nonce,
            "gas": 3000000,
            "gasPrice": w3.eth.gas_price,
        })

        signed = w3.eth.account.sign_transaction(deploy_tx, ADMIN_PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)

        logger.info(f"📤 Deploying CertificateRegistry: {tx_hash.hex()}")

        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

        if receipt.status != 1:
            logger.error("❌ Deployment failed!")
            return None, False

        cert_registry_address = receipt.contractAddress

        logger.info(f"✅ CertificateRegistry deployed at: {cert_registry_address}")

        # -------------------------------------------
        # STEP 2 — Register in InstitutionRegistry
        # -------------------------------------------

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
            "from": deployer.address,
            "nonce": nonce,
            "gas": 500000,
            "gasPrice": w3.eth.gas_price,
        })

        signed = w3.eth.account.sign_transaction(register_tx, ADMIN_PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)

        logger.info(f"📤 Registering institution: {tx_hash.hex()}")

        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

        if receipt.status != 1:
            logger.error("❌ Registration failed!")
            return cert_registry_address, False

        logger.info("✅ Institution registered successfully")
        return cert_registry_address, True

    except Exception as e:
        logger.error("❌ Deployment error", exc_info=True)
        return None, False


# ============================================================
# Institution Approval Handler
# ============================================================

def _handle_institution_approved(institution):
    from .models import Institution

    logger.info("============================================================")
    logger.info(f"🏛️ Processing institution approval: {institution.institution_name}")
    logger.info("============================================================")

    try:
        # Generate ID if missing
        if not institution.institution_id:
            institution.institution_id = institution.generate_institution_id()
            institution.save(update_fields=["institution_id"])

        # Deploy contract
        contract_address, success = _deploy_certificate_registry_and_register(
            institution.wallet_address,
            institution.institution_id,
            institution.institution_name
        )

        if not success:
            raise Exception("Contract deployment failed")

        institution.contract_address = contract_address
        institution.deployed_at = timezone.now()
        institution.registered_in_registry = True

        institution.save(update_fields=[
            "contract_address",
            "deployed_at",
            "registered_in_registry"
        ])

        logger.info("✅ Institution contract ready")

    except Exception as e:
        logger.error("❌ Institution setup failed", exc_info=True)
        institution.status = Institution.Status.PENDING
        institution.save(update_fields=["status"])
        raise


register("institution_approved", _handle_institution_approved)
