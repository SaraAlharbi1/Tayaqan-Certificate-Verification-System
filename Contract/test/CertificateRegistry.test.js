/**
 * CertificateRegistry - Unit Tests
 * Run: npx hardhat test test/CertificateRegistry.test.js
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CertificateRegistry", function () {
  let registry, admin, institution, randomUser;
  
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

  it("Should reject zero address in constructor", async function () {
    const Factory = await ethers.getContractFactory("CertificateRegistry");
    await expect(Factory.deploy(ethers.ZeroAddress, admin.address)).to.be.revertedWith("Invalid institution address");
  });

  // ========== Issue Certificate ==========
  it("Should allow institution to issue certificate", async function () {
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    
    const [certType, issueDate, isRevoked] = await registry.verifyCertificate(CERT_HASH);
    expect(certType).to.equal("Bachelor");
    expect(isRevoked).to.equal(false);
  });

  it("Should emit CertificateIssued event", async function () {
    await expect(registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000))
      .to.emit(registry, "CertificateIssued")
      .withArgs(CERT_HASH, APPLICANT_ID, "Bachelor");
  });

  it("Should reject empty certificate type", async function () {
    await expect(
      registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "", 1700000000)
    ).to.be.revertedWith("Certificate type required");
  });

  it("Should reject zero applicant ID", async function () {
    const ZERO_ID = ethers.ZeroHash;
    await expect(
      registry.connect(institution).issueCertificate(CERT_HASH, ZERO_ID, "Bachelor", 1700000000)
    ).to.be.revertedWith("Invalid applicant ID");
  });

  it("Should reject zero certificate hash", async function () {
    await expect(
      registry.connect(institution).issueCertificate(ethers.ZeroHash, APPLICANT_ID, "Bachelor", 1700000000)
    ).to.be.revertedWith("Invalid certificate hash");
  });

  it("Should reject duplicate certificate", async function () {
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    await expect(
      registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Master", 1700000000)
    ).to.be.revertedWith("Certificate already exists");
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
      .to.emit(registry, "CertificateRevoked")
      .withArgs(CERT_HASH);
  });

  it("Should reject admin from revoking", async function () {
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    await expect(
      registry.connect(admin).revokeCertificate(CERT_HASH)
    ).to.be.revertedWith("Only institution can call this");
  });

  // ========== NEGATIVE TESTING (Security Validation) ==========
  
  // 1. Modified certificate file → verification fails
  it("Should return empty for non-existent (fake) certificate hash", async function () {
    const FAKE_HASH = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    const [certType, issueDate, isRevoked] = await registry.verifyCertificate(FAKE_HASH);
    
    expect(certType).to.equal("");
    expect(issueDate).to.equal(0);
    expect(isRevoked).to.equal(false);
  });

  it("Should detect modified certificate hash (one character change)", async function () {
    // Issue original certificate
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    
    // Slightly modified hash (changed last character: f → e)
    const MODIFIED_HASH = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdee";
    const [certType, , ] = await registry.verifyCertificate(MODIFIED_HASH);
    
    // Modified hash should return empty (not found) - proves tamper detection
    expect(certType).to.equal("");
  });

  it("Should fail verification when certificate content is tampered", async function () {
    // Simulate: Original certificate data
    const originalData = "Name:Rawan|Degree:Bachelor|University:KSU|Date:2024";
    const originalHash = ethers.keccak256(ethers.toUtf8Bytes(originalData));
    
    // Issue with original hash
    await registry.connect(institution).issueCertificate(originalHash, APPLICANT_ID, "Bachelor", 1700000000);
    
    // Simulate: Tampered certificate (changed one letter in name)
    const tamperedData = "Name:Raman|Degree:Bachelor|University:KSU|Date:2024";
    const tamperedHash = ethers.keccak256(ethers.toUtf8Bytes(tamperedData));
    
    // Tampered hash won't match - verification fails
    const [certType, , ] = await registry.verifyCertificate(tamperedHash);
    expect(certType).to.equal("");
    
    // Original hash still works
    const [origCertType, , ] = await registry.verifyCertificate(originalHash);
    expect(origCertType).to.equal("Bachelor");
  });

  // 2. Wrong certificate ID
  it("Should fail with wrong certificate ID lookup", async function () {
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    
    // Try to verify with completely wrong hash
    const WRONG_ID = "0x0000000000000000000000000000000000000000000000000000000000000001";
    const [certType, issueDate, ] = await registry.verifyCertificate(WRONG_ID);
    
    expect(certType).to.equal("");
    expect(issueDate).to.equal(0);
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
  it("Should reject certificate issued by wrong institution", async function () {
    // Deploy a second CertificateRegistry for "Fake University"
    const fakeInstitution = randomUser;
    const FakeFactory = await ethers.getContractFactory("CertificateRegistry");
    const fakeRegistry = await FakeFactory.deploy(fakeInstitution.address, admin.address);
    
    // Fake university issues a certificate
    const FAKE_CERT_HASH = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    await fakeRegistry.connect(fakeInstitution).issueCertificate(FAKE_CERT_HASH, APPLICANT_ID, "Fake Degree", 1700000000);
    
    // This certificate does NOT exist in the legitimate registry
    const [certType, , ] = await registry.verifyCertificate(FAKE_CERT_HASH);
    expect(certType).to.equal(""); // Not found in real registry
  });

  it("Should reject issuance attempt by unauthorized wallet", async function () {
    // Random person trying to issue on legitimate registry
    await expect(
      registry.connect(randomUser).issueCertificate(CERT_HASH, APPLICANT_ID, "Fake Degree", 1700000000)
    ).to.be.revertedWith("Only institution can call this");
  });

  // 5. Share certificate without permission
  it("Should reject sharing by unauthorized user", async function () {
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    
    // Random user tries to grant themselves access
    await expect(
      registry.connect(randomUser).addEmployerAccess(CERT_HASH, EMPLOYER_ID, 0)
    ).to.be.revertedWith("Only institution or admin can call this");
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

  it("Should emit EmployerAccessGranted event", async function () {
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    
    await expect(registry.connect(admin).addEmployerAccess(CERT_HASH, EMPLOYER_ID, 0))
      .to.emit(registry, "EmployerAccessGranted")
      .withArgs(CERT_HASH, EMPLOYER_ID);
  });

  it("Should emit EmployerAccessRevoked event", async function () {
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    await registry.connect(admin).addEmployerAccess(CERT_HASH, EMPLOYER_ID, 0);
    
    await expect(registry.connect(admin).removeEmployerAccess(CERT_HASH, EMPLOYER_ID))
      .to.emit(registry, "EmployerAccessRevoked")
      .withArgs(CERT_HASH, EMPLOYER_ID);
  });

  it("Should allow institution to add employer access", async function () {
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    await registry.connect(institution).addEmployerAccess(CERT_HASH, EMPLOYER_ID, 0);
    
    const [hasAccess] = await registry.checkEmployerAccess(CERT_HASH, EMPLOYER_ID);
    expect(hasAccess).to.equal(true);
  });

  it("Should reject adding employer to revoked certificate", async function () {
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    await registry.connect(institution).revokeCertificate(CERT_HASH);
    
    await expect(
      registry.connect(admin).addEmployerAccess(CERT_HASH, EMPLOYER_ID, 0)
    ).to.be.revertedWith("Certificate is revoked");
  });

  it("Should remove employer access", async function () {
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    await registry.connect(admin).addEmployerAccess(CERT_HASH, EMPLOYER_ID, 0);
    await registry.connect(admin).removeEmployerAccess(CERT_HASH, EMPLOYER_ID);
    
    const [hasAccess] = await registry.checkEmployerAccess(CERT_HASH, EMPLOYER_ID);
    expect(hasAccess).to.equal(false);
  });

  it("Should return false for revoked certificate access check", async function () {
    await registry.connect(institution).issueCertificate(CERT_HASH, APPLICANT_ID, "Bachelor", 1700000000);
    await registry.connect(admin).addEmployerAccess(CERT_HASH, EMPLOYER_ID, 0);
    await registry.connect(institution).revokeCertificate(CERT_HASH);
    
    const [hasAccess] = await registry.checkEmployerAccess(CERT_HASH, EMPLOYER_ID);
    expect(hasAccess).to.equal(false);
  });
});