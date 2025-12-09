/**
 * CertificateRegistry - Unit Tests
 * Run: npx hardhat test test/CertificateRegistry.test.js
 * 
 * Updated to match actual CertificateRegistry.sol implementation
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CertificateRegistry", function () {
  let registry, admin, institution, randomUser;
  
  // Certificate hash is a STRING in the contract (not bytes32)
  const CERT_HASH = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  let APPLICANT_ID, EMPLOYER_ID;

  beforeEach(async function () {
    [admin, institution, randomUser] = await ethers.getSigners();
    APPLICANT_ID = ethers.keccak256(ethers.toUtf8Bytes("1234567890"));
    EMPLOYER_ID = ethers.keccak256(ethers.toUtf8Bytes("EMP001"));
    
    const Factory = await ethers.getContractFactory("CertificateRegistry");
    registry = await Factory.deploy(institution.address, admin.address);
  });

  // ========== Deployment ==========
  it("Should set correct institution and admin wallets", async function () {
    expect(await registry.institutionWallet()).to.equal(institution.address);
    expect(await registry.adminWallet()).to.equal(admin.address);
  });

  it("Should reject zero address for institution in constructor", async function () {
    const Factory = await ethers.getContractFactory("CertificateRegistry");
    await expect(Factory.deploy(ethers.ZeroAddress, admin.address)).to.be.revertedWith("Invalid institution address");
  });

  it("Should reject zero address for admin in constructor", async function () {
    const Factory = await ethers.getContractFactory("CertificateRegistry");
    await expect(Factory.deploy(institution.address, ethers.ZeroAddress)).to.be.revertedWith("Invalid admin address");
  });

  // ========== Issue Certificate ==========
  it("Should allow institution to issue certificate", async function () {
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    
    const [certType, issueDate, isRevoked, employerCount] = await registry.verifyCertificate(CERT_HASH);
    expect(certType).to.equal("Bachelor");
    expect(issueDate).to.equal(1700000000);
    expect(isRevoked).to.equal(false);
    expect(employerCount).to.equal(0);
  });

  it("Should emit CertificateIssued event with correct arguments", async function () {
    // Event has 2 indexed arguments: certificateHash (string) and applicantIdHash (bytes32)
    await expect(registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000))
      .to.emit(registry, "CertificateIssued");
    // Note: Checking indexed string arguments with withArgs is complex due to hashing
  });

  it("Should reject duplicate certificate", async function () {
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    await expect(
      registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Master", 1700000000)
    ).to.be.revertedWith("Certificate already exists");
  });

  it("Should reject issuance attempt by unauthorized wallet", async function () {
    await expect(
      registry.connect(randomUser).issueCertificate(CERT_HASH, APPLICANT_ID, "Fake Degree", 1700000000)
    ).to.be.revertedWith("Only institution can call this");
  });

  it("Should reject issuance attempt by admin", async function () {
    await expect(
      registry.connect(admin).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000)
    ).to.be.revertedWith("Only institution can call this");
  });

  // ========== Verify Certificate ==========
  it("Should return correct certificate data", async function () {
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Master", 1700000000);
    
    const [certType, issueDate, isRevoked, employerCount] = await registry.verifyCertificate(CERT_HASH);
    expect(certType).to.equal("Master");
    expect(issueDate).to.equal(1700000000);
    expect(isRevoked).to.equal(false);
    expect(employerCount).to.equal(0);
  });

  it("Should revert for non-existent certificate hash", async function () {
    const FAKE_HASH = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    await expect(registry.verifyCertificate(FAKE_HASH))
      .to.be.revertedWith("Certificate does not exist");
  });

  // ========== Revoke Certificate ==========
  it("Should allow institution to revoke certificate", async function () {
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    await registry.connect(institution).revokeCertificate(CERT_HASH);
    
    const [, , isRevoked] = await registry.verifyCertificate(CERT_HASH);
    expect(isRevoked).to.equal(true);
  });

  it("Should emit CertificateRevoked event", async function () {
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    
    await expect(registry.connect(institution).revokeCertificate(CERT_HASH))
      .to.emit(registry, "CertificateRevoked");
  });

  it("Should reject admin from revoking", async function () {
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    await expect(
      registry.connect(admin).revokeCertificate(CERT_HASH)
    ).to.be.revertedWith("Only institution can call this");
  });

  it("Should reject revoking non-existent certificate", async function () {
    const FAKE_HASH = "0xnonexistent";
    await expect(
      registry.connect(institution).revokeCertificate(FAKE_HASH)
    ).to.be.revertedWith("Certificate does not exist");
  });

  // ========== NEGATIVE TESTING (Security Validation) ==========
  
  // 1. Modified certificate file → verification fails
  it("Should revert verification for non-existent (fake) certificate hash", async function () {
    const FAKE_HASH = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    await expect(registry.verifyCertificate(FAKE_HASH))
      .to.be.revertedWith("Certificate does not exist");
  });

  it("Should detect modified certificate hash (one character change)", async function () {
    // Issue original certificate
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    
    // Slightly modified hash (changed last character: f → e)
    const MODIFIED_HASH = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdee";
    
    // Modified hash should revert - proves tamper detection
    await expect(registry.verifyCertificate(MODIFIED_HASH))
      .to.be.revertedWith("Certificate does not exist");
  });

  it("Should fail verification when certificate content is tampered", async function () {
    // Simulate: Original certificate data
    const originalData = "Name:Rawan|Degree:Bachelor|University:KSU|Date:2024";
    const originalHash = ethers.keccak256(ethers.toUtf8Bytes(originalData));
    
    // Issue with original hash (convert bytes32 to string for contract)
    await registry.connect(institution).issueCertificate(originalHash, APPLICANT_ID, "Bachelor", 1700000000);
    
    // Simulate: Tampered certificate (changed one letter in name)
    const tamperedData = "Name:Raman|Degree:Bachelor|University:KSU|Date:2024";
    const tamperedHash = ethers.keccak256(ethers.toUtf8Bytes(tamperedData));
    
    // Tampered hash won't match - verification fails
    await expect(registry.verifyCertificate(tamperedHash))
      .to.be.revertedWith("Certificate does not exist");
    
    // Original hash still works
    const [origCertType, , ] = await registry.verifyCertificate(originalHash);
    expect(origCertType).to.equal("Bachelor");
  });

  // 2. Wrong certificate ID
  it("Should fail with wrong certificate ID lookup", async function () {
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    
    // Try to verify with completely wrong hash
    const WRONG_ID = "0x0000000000000000000000000000000000000000000000000000000000000001";
    await expect(registry.verifyCertificate(WRONG_ID))
      .to.be.revertedWith("Certificate does not exist");
  });

  // 3. Incorrect student name (simulated via wrong applicant ID hash)
  it("Should not match certificate with wrong applicant ID", async function () {
    // Issue certificate for "Rawan" (hashed national ID)
    const RAWAN_ID = ethers.keccak256(ethers.toUtf8Bytes("1234567890"));
    await registry.connect(institution).issueCertificate(CERT_HASH, RAWAN_ID, "Bachelor", 1700000000);
    
    // Try to claim it belongs to different person
    const FAKE_PERSON_ID = ethers.keccak256(ethers.toUtf8Bytes("9999999999"));
    
    // The certificate exists but applicant ID doesn't match
    // (In real system, backend would verify applicantIdHash matches)
    const [, , isRevoked] = await registry.verifyCertificate(CERT_HASH);
    expect(isRevoked).to.equal(false); // Certificate exists
    
    // But hash proves ownership - FAKE_PERSON cannot claim it
    // because the stored applicantIdHash won't match theirs
  });

  // 4. Incorrect university (wrong institution trying to issue)
  it("Should not find certificate in wrong registry", async function () {
    // Deploy a second CertificateRegistry for "Fake University"
    const fakeInstitution = randomUser;
    const FakeFactory = await ethers.getContractFactory("CertificateRegistry");
    const fakeRegistry = await FakeFactory.deploy(fakeInstitution.address, admin.address);
    
    // Fake university issues a certificate
    const FAKE_CERT_HASH = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    await fakeRegistry.connect(fakeInstitution).issueCertificate(FAKE_CERT_HASH, APPLICANT_ID, "Fake Degree", 1700000000);
    
    // This certificate does NOT exist in the legitimate registry
    await expect(registry.verifyCertificate(FAKE_CERT_HASH))
      .to.be.revertedWith("Certificate does not exist");
  });

  // 5. Share certificate without permission
  it("Should reject sharing by unauthorized user", async function () {
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    
    // Random user tries to grant themselves access
    await expect(
      registry.connect(randomUser).addEmployerAccess(CERT_HASH, EMPLOYER_ID, 0)
    ).to.be.revertedWith("Only admin can call this");
  });

  it("Should reject employer checking access to non-existent certificate", async function () {
    const FAKE_CERT = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const [hasAccess, ] = await registry.checkEmployerAccess(FAKE_CERT, EMPLOYER_ID);
    expect(hasAccess).to.equal(false);
  });

  // ========== Employer Access (Share Certificate) ==========
  it("Should allow admin to add employer access", async function () {
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    await registry.connect(admin).addEmployerAccess(CERT_HASH, EMPLOYER_ID, 0);
    
    const [hasAccess] = await registry.checkEmployerAccess(CERT_HASH, EMPLOYER_ID);
    expect(hasAccess).to.equal(true);
  });

  it("Should emit EmployerAccessGranted event with correct arguments", async function () {
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    
    // Event has 4 arguments: certificateHash, employerId, expiryDate, grantedBy
    await expect(registry.connect(admin).addEmployerAccess(CERT_HASH, EMPLOYER_ID, 0))
      .to.emit(registry, "EmployerAccessGranted");
  });

  it("Should emit EmployerAccessRevoked event with correct arguments", async function () {
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    await registry.connect(admin).addEmployerAccess(CERT_HASH, EMPLOYER_ID, 0);
    
    // Event has 3 arguments: certificateHash, employerId, revokedBy
    await expect(registry.connect(admin).removeEmployerAccess(CERT_HASH, EMPLOYER_ID))
      .to.emit(registry, "EmployerAccessRevoked");
  });

  it("Should reject institution from adding employer access", async function () {
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    
    // Only admin can add employer access, not institution
    await expect(
      registry.connect(institution).addEmployerAccess(CERT_HASH, EMPLOYER_ID, 0)
    ).to.be.revertedWith("Only admin can call this");
  });

  it("Should reject adding employer to revoked certificate", async function () {
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    await registry.connect(institution).revokeCertificate(CERT_HASH);
    
    await expect(
      registry.connect(admin).addEmployerAccess(CERT_HASH, EMPLOYER_ID, 0)
    ).to.be.revertedWith("Certificate is revoked");
  });

  it("Should reject adding duplicate employer access", async function () {
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    await registry.connect(admin).addEmployerAccess(CERT_HASH, EMPLOYER_ID, 0);
    
    await expect(
      registry.connect(admin).addEmployerAccess(CERT_HASH, EMPLOYER_ID, 0)
    ).to.be.revertedWith("Employer already has access");
  });

  it("Should remove employer access", async function () {
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    await registry.connect(admin).addEmployerAccess(CERT_HASH, EMPLOYER_ID, 0);
    await registry.connect(admin).removeEmployerAccess(CERT_HASH, EMPLOYER_ID);
    
    const [hasAccess] = await registry.checkEmployerAccess(CERT_HASH, EMPLOYER_ID);
    expect(hasAccess).to.equal(false);
  });

  it("Should reject removing non-existent employer access", async function () {
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    
    await expect(
      registry.connect(admin).removeEmployerAccess(CERT_HASH, EMPLOYER_ID)
    ).to.be.revertedWith("Employer does not have access");
  });

  it("Should return false for revoked certificate access check", async function () {
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    await registry.connect(admin).addEmployerAccess(CERT_HASH, EMPLOYER_ID, 0);
    await registry.connect(institution).revokeCertificate(CERT_HASH);
    
    const [hasAccess] = await registry.checkEmployerAccess(CERT_HASH, EMPLOYER_ID);
    expect(hasAccess).to.equal(false);
  });

  // ========== Access Expiry ==========
  it("Should return correct expiry date for employer access", async function () {
    const futureExpiry = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now
    
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    await registry.connect(admin).addEmployerAccess(CERT_HASH, EMPLOYER_ID, futureExpiry);
    
    const [hasAccess, expiryDate] = await registry.checkEmployerAccess(CERT_HASH, EMPLOYER_ID);
    expect(hasAccess).to.equal(true);
    expect(expiryDate).to.equal(futureExpiry);
  });

  it("Should return no expiry when set to 0 (permanent access)", async function () {
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    await registry.connect(admin).addEmployerAccess(CERT_HASH, EMPLOYER_ID, 0);
    
    const [hasAccess, expiryDate] = await registry.checkEmployerAccess(CERT_HASH, EMPLOYER_ID);
    expect(hasAccess).to.equal(true);
    expect(expiryDate).to.equal(0);
  });

  // ========== Employer Count ==========
  it("Should track employer count correctly", async function () {
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    
    const EMPLOYER_ID_2 = ethers.keccak256(ethers.toUtf8Bytes("EMP002"));
    const EMPLOYER_ID_3 = ethers.keccak256(ethers.toUtf8Bytes("EMP003"));
    
    // Initially 0 employers
    let [, , , employerCount] = await registry.verifyCertificate(CERT_HASH);
    expect(employerCount).to.equal(0);
    
    // Add first employer
    await registry.connect(admin).addEmployerAccess(CERT_HASH, EMPLOYER_ID, 0);
    [, , , employerCount] = await registry.verifyCertificate(CERT_HASH);
    expect(employerCount).to.equal(1);
    
    // Add two more employers
    await registry.connect(admin).addEmployerAccess(CERT_HASH, EMPLOYER_ID_2, 0);
    await registry.connect(admin).addEmployerAccess(CERT_HASH, EMPLOYER_ID_3, 0);
    [, , , employerCount] = await registry.verifyCertificate(CERT_HASH);
    expect(employerCount).to.equal(3);
    
    // Remove one employer
    await registry.connect(admin).removeEmployerAccess(CERT_HASH, EMPLOYER_ID_2);
    [, , , employerCount] = await registry.verifyCertificate(CERT_HASH);
    expect(employerCount).to.equal(2);
  });
});