/**
 * TAYAQAN - Integration Tests
 * Run: npx hardhat test test/Integration.test.js
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Integration Tests", function () {
  let institutionRegistry, certificateRegistry;
  let admin, institution, employer;
  
  const CERT_HASH = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  let APPLICANT_ID, EMPLOYER_ID;

  beforeEach(async function () {
    [admin, institution, employer] = await ethers.getSigners();
    APPLICANT_ID = ethers.keccak256(ethers.toUtf8Bytes("1234567890"));
    EMPLOYER_ID = ethers.keccak256(ethers.toUtf8Bytes("EMP001"));
    
    // Deploy both contracts
    const InstFactory = await ethers.getContractFactory("InstitutionRegistry");
    institutionRegistry = await InstFactory.deploy();
    
    const CertFactory = await ethers.getContractFactory("CertificateRegistry");
    certificateRegistry = await CertFactory.deploy(institution.address, admin.address);
  });

  it("Full workflow: register → issue → verify → grant access → check", async function () {
    // 1. Register institution
    await institutionRegistry.registerInstitution(
      "KSU001", 
      "King Saud University", 
      await certificateRegistry.getAddress(), 
      institution.address
    );
    
    // 2. Issue certificate
    await certificateRegistry.connect(institution).issueCertificate(
      CERT_HASH, APPLICANT_ID, "Bachelor", Math.floor(Date.now() / 1000)
    );
    
    // 3. Verify certificate
    const [certType, , isRevoked] = await certificateRegistry.verifyCertificate(CERT_HASH);
    expect(certType).to.equal("Bachelor");
    expect(isRevoked).to.equal(false);
    
    // 4. Grant employer access
    await certificateRegistry.connect(admin).addEmployerAccess(CERT_HASH, EMPLOYER_ID, 0);
    
    // 5. Check employer access
    const [hasAccess] = await certificateRegistry.checkEmployerAccess(CERT_HASH, EMPLOYER_ID);
    expect(hasAccess).to.equal(true);
  });

  it("Revocation invalidates employer access", async function () {
    // Setup
    await certificateRegistry.connect(institution).issueCertificate(
      CERT_HASH, APPLICANT_ID, "Bachelor", Math.floor(Date.now() / 1000)
    );
    await certificateRegistry.connect(admin).addEmployerAccess(CERT_HASH, EMPLOYER_ID, 0);
    
    // Verify access before
    let [hasAccess] = await certificateRegistry.checkEmployerAccess(CERT_HASH, EMPLOYER_ID);
    expect(hasAccess).to.equal(true);
    
    // Revoke
    await certificateRegistry.connect(institution).revokeCertificate(CERT_HASH);
    
    // Verify access after (should be false)
    [hasAccess] = await certificateRegistry.checkEmployerAccess(CERT_HASH, EMPLOYER_ID);
    expect(hasAccess).to.equal(false);
  });
});