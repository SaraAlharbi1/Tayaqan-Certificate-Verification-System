const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Integration Tests", function () {
  let registry, certificate;
  let admin, institution, applicant;
  
  const institutionId = "KSU-001";
  const institutionName = "King Saud University";
  const certHash = "0xabc123def456";
  const applicantHash = ethers.keccak256(ethers.toUtf8Bytes("1234567890"));

  beforeEach(async function () {
    [admin, institution, applicant] = await ethers.getSigners();

    // Deploy InstitutionRegistry
    const InstitutionRegistry = await ethers.getContractFactory("InstitutionRegistry");
    registry = await InstitutionRegistry.deploy();
    await registry.waitForDeployment();

    // Deploy CertificateRegistry
    const CertificateRegistry = await ethers.getContractFactory("CertificateRegistry");
    certificate = await CertificateRegistry.deploy(institution.address);
    await certificate.waitForDeployment();

    // Register institution
    await registry.registerInstitution(
      institutionId,
      institutionName,
      await certificate.getAddress(),
      institution.address
    );
  });

  it("Should complete full workflow: register, issue, verify", async function () {
    // 1. Verify institution is registered
    const [name, certContract] = await registry.getInstitution(institutionId);
    expect(name).to.equal(institutionName);
    expect(certContract).to.equal(await certificate.getAddress());

    // 2. Issue certificate
    await certificate.connect(institution).issueCertificate(
      certHash,
      applicantHash,
      "Bachelor of Engineering",
      Math.floor(Date.now() / 1000)
    );

    // 3. Verify certificate
    const [type, date, isRevoked] = await certificate.verifyCertificate(certHash);
    expect(type).to.equal("Bachelor of Engineering");
    expect(isRevoked).to.be.false;

    // 4. Get applicant certificates
    const certs = await certificate.getApplicantCertificates(applicantHash);
    expect(certs.length).to.equal(1);
    expect(certs[0]).to.equal(certHash);
  });

  it("Should handle multiple institutions and certificates", async function () {
    // Deploy second institution
    const [, institution2] = await ethers.getSigners();
    const CertificateRegistry = await ethers.getContractFactory("CertificateRegistry");
    const certificate2 = await CertificateRegistry.deploy(institution2.address);
    await certificate2.waitForDeployment();

    await registry.registerInstitution(
      "KAUST-001",
      "KAUST",
      await certificate2.getAddress(),
      institution2.address
    );

    // Issue certificates from both institutions for same applicant
    await certificate.connect(institution).issueCertificate(
      certHash,
      applicantHash,
      "Bachelor",
      Math.floor(Date.now() / 1000)
    );

    await certificate2.connect(institution2).issueCertificate(
      "0x789xyz",
      applicantHash,
      "Master",
      Math.floor(Date.now() / 1000)
    );

    // Verify both certificates
    const [type1] = await certificate.verifyCertificate(certHash);
    const [type2] = await certificate2.verifyCertificate("0x789xyz");

    expect(type1).to.equal("Bachelor");
    expect(type2).to.equal("Master");

    // Check applicant has certificates from both institutions
    const certs1 = await certificate.getApplicantCertificates(applicantHash);
    const certs2 = await certificate2.getApplicantCertificates(applicantHash);

    expect(certs1.length).to.equal(1);
    expect(certs2.length).to.equal(1);
  });
});