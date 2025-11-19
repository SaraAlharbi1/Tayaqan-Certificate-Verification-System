"""Contract ABIs and utilities for blockchain interaction."""

import json
from pathlib import Path
from web3 import Web3

# ============================================================
# Path Configuration
# ============================================================

# Project root: backend/helpers/ -> backend/ -> project_root/
PROJECT_ROOT = Path(__file__).resolve().parents[2]

# Hardhat deployments directory
DEPLOYMENTS_DIR = PROJECT_ROOT / "contract" / "deployments" / "localhost"


# ============================================================
# Helper Functions
# ============================================================

def _load_hardhat_artifact(contract_name: str):
    """
    Load contract ABI and address from Hardhat deployment artifact.
    
    Expected JSON structure:
    {
      "address": "0x...",
      "abi": [...]
    }
    """
    artifact_path = DEPLOYMENTS_DIR / f"{contract_name}.json"

    if not artifact_path.exists():
        raise FileNotFoundError(f"Artifact not found: {artifact_path}")

    with artifact_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    if "abi" not in data or "address" not in data:
        raise ValueError(f"Invalid artifact format: {artifact_path}")

    return data["address"], data["abi"]


# ============================================================
# InstitutionRegistry Contract
# ============================================================

InstitutionRegistry_abi = None
InstitutionRegistry_address = None

try:
    address, abi = _load_hardhat_artifact("InstitutionRegistry")
    InstitutionRegistry_address = Web3.to_checksum_address(address)
    InstitutionRegistry_abi = abi
    print(f"✅ [contracts] InstitutionRegistry loaded: {InstitutionRegistry_address}")
except Exception as e:
    print(f"❌ [contracts] InstitutionRegistry failed: {e}")


# ============================================================
# CertificateRegistry Contract (Template for deployment)
# ============================================================

CertificateRegistry_abi = None
CertificateRegistry_bytecode = None

try:
    # Load from Hardhat artifacts (not deployments)
    artifact_path = PROJECT_ROOT / "contract" / "artifacts" / "contracts" / "CertificateRegistry.sol" / "CertificateRegistry.json"
    
    if artifact_path.exists():
        with artifact_path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        
        CertificateRegistry_abi = data.get("abi")
        CertificateRegistry_bytecode = data.get("bytecode")
        print(f"✅ [contracts] CertificateRegistry ABI loaded ({len(CertificateRegistry_abi)} functions)")
    else:
        print(f"❌ [contracts] CertificateRegistry artifact not found: {artifact_path}")
except Exception as e:
    print(f"❌ [contracts] CertificateRegistry failed: {e}")


# ============================================================
# Verification Helper
# ============================================================

def verify_contracts():
    """Verify all required contracts are loaded."""
    issues = []
    
    if not InstitutionRegistry_abi:
        issues.append("InstitutionRegistry ABI missing")
    if not InstitutionRegistry_address:
        issues.append("InstitutionRegistry address missing")
    if not CertificateRegistry_abi:
        issues.append("CertificateRegistry ABI missing")
    if not CertificateRegistry_bytecode:
        issues.append("CertificateRegistry bytecode missing")
    
    if issues:
        print("\n❌ [contracts] Issues found:")
        for issue in issues:
            print(f"  - {issue}")
        return False
    
    print("\n✅ [contracts] All contracts verified!")
    return True


# Run verification on import
verify_contracts()