const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CertificateRegistry", function () {
  let certificate;
  let institution, applicant, other;
  
  const certHash1 = "0xabc123def456";
  const certHash2 = "0x789xyz321";
  const applicantHash = ethers.keccak256(ethers.toUtf8Bytes("1234567890"));
  const certType = "Bachelor of Engineering";
  const issueDate = Math.floor(Date.now() / 1000);

  beforeEach(async function () {
    [institution, applicant, other] = await ethers.getSigners();

    const CertificateRegistry = await ethers.getContractFactory("CertificateRegistry");
    certificate = await CertificateRegistry.deploy(institution.address);
    await certificate.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct institution wallet", async function () {
      expect(await certificate.institutionWallet()).to.equal(institution.address);
    });
  });

  describe("Issue Certificate", function () {
    it("Should issue a certificate", async function () {
      await certificate.connect(institution).issueCertificate(
        certHash1,
        applicantHash,
        certType,
        issueDate
      );

      const [type, date, isRevoked] = await certificate.verifyCertificate(certHash1);
      
      expect(type).to.equal(certType);
      expect(date).to.equal(issueDate);
      expect(isRevoked).to.be.false;
    });

    it("Should emit CertificateIssued event", async function () {
      await expect(
        certificate.connect(institution).issueCertificate(
          certHash1,
          applicantHash,
          certType,
          issueDate
        )
      )
        .to.emit(certificate, "CertificateIssued")
        .withArgs(certHash1, applicantHash);
    });

    it("Should add certificate to applicant's list", async function () {
      await certificate.connect(institution).issueCertificate(
        certHash1,
        applicantHash,
        certType,
        issueDate
      );

      const certs = await certificate.getApplicantCertificates(applicantHash);
      expect(certs.length).to.equal(1);
      expect(certs[0]).to.equal(certHash1);
    });

    it("Should fail if not called by institution", async function () {
      await expect(
        certificate.connect(other).issueCertificate(
          certHash1,
          applicantHash,
          certType,
          issueDate
        )
      ).to.be.revertedWith("Only institution");
    });
  });

  describe("Verify Certificate", function () {
    beforeEach(async function () {
      await certificate.connect(institution).issueCertificate(
        certHash1,
        applicantHash,
        certType,
        issueDate
      );
    });

    it("Should verify certificate details", async function () {
      const [type, date, isRevoked] = await certificate.verifyCertificate(certHash1);
      
      expect(type).to.equal(certType);
      expect(date).to.equal(issueDate);
      expect(isRevoked).to.be.false;
    });

    it("Should be callable by anyone", async function () {
      const [type] = await certificate.connect(other).verifyCertificate(certHash1);
      expect(type).to.equal(certType);
    });

    it("Should return empty for non-existent certificate", async function () {
      const [type, date, isRevoked] = await certificate.verifyCertificate("0xnonexistent");
      expect(type).to.equal("");
      expect(date).to.equal(0);
      expect(isRevoked).to.be.false;
    });
  });

  describe("Revoke Certificate", function () {
    beforeEach(async function () {
      await certificate.connect(institution).issueCertificate(
        certHash1,
        applicantHash,
        certType,
        issueDate
      );
    });

    it("Should revoke a certificate", async function () {
      await certificate.connect(institution).revokeCertificate(certHash1);

      const [, , isRevoked] = await certificate.verifyCertificate(certHash1);
      expect(isRevoked).to.be.true;
    });

    it("Should emit CertificateRevoked event", async function () {
      await expect(
        certificate.connect(institution).revokeCertificate(certHash1)
      )
        .to.emit(certificate, "CertificateRevoked")
        .withArgs(certHash1);
    });

    it("Should fail if not called by institution", async function () {
      await expect(
        certificate.connect(other).revokeCertificate(certHash1)
      ).to.be.revertedWith("Only institution");
    });
  });

  describe("Get Applicant Certificates", function () {
    it("Should return all certificates for an applicant", async function () {
      // Issue multiple certificates
      await certificate.connect(institution).issueCertificate(
        certHash1,
        applicantHash,
        "Bachelor of Engineering",
        issueDate
      );
      
      await certificate.connect(institution).issueCertificate(
        certHash2,
        applicantHash,
        "Master of Computer Science",
        issueDate + 1000
      );

      const certs = await certificate.getApplicantCertificates(applicantHash);
      
      expect(certs.length).to.equal(2);
      expect(certs[0]).to.equal(certHash1);
      expect(certs[1]).to.equal(certHash2);
    });

    it("Should return empty array for applicant with no certificates", async function () {
      const otherApplicantHash = ethers.keccak256(ethers.toUtf8Bytes("9999999999"));
      const certs = await certificate.getApplicantCertificates(otherApplicantHash);
      
      expect(certs.length).to.equal(0);
    });
  });
});