// TayaqanCertificate Test
// ------------------------------------------------------
// - Hardhat + Mocha (describe/it) + Chai (expect)
// - Validates core contract functions + custom errors
// - Ensures only contract owner can issue/revoke/approve

const { expect } = require("chai");
const { ethers } = require("hardhat");

// Helper: keccak256 hash from string (simulate file hash, IDs)
const h = (s) => ethers.keccak256(ethers.toUtf8Bytes(s));

// Example identifiers
const APPLICANT_ID = "1118997672";   // applicant's national ID
const VERIFIER_ID  = "1010123456";   // verifier's CR number

describe("TayaqanCertificate", function () {
  let owner, other, contract;

  beforeEach(async () => {
    [owner, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("TayaqanCertificate", owner);
    contract = await Factory.deploy(owner.address);
    await contract.waitForDeployment();
  });

  // ------------------ Deployment ------------------
  it("sets the correct owner on deploy", async () => {
    expect(await contract.owner()).to.equal(owner.address);
  });

  // ------------------ Issue Certificate ------------------
  describe("issueCertificate", () => {
    const applicantIdHash = h(APPLICANT_ID);
    const fileHash = h("transcript.pdf");

    it("only the owner can issue", async () => {
      await expect(
        contract.connect(other).issueCertificate(applicantIdHash, fileHash)
      )
        .to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount")
        .withArgs(other.address);
    });

    it("issues certificate and emits event", async () => {
      const tx = await contract.issueCertificate(applicantIdHash, fileHash);
      await expect(tx)
        .to.emit(contract, "CertificateIssued")
        .withArgs(applicantIdHash, fileHash, anyUint64());

      const [a, issuedAt, revoked] = await contract.getCertificate(fileHash);
      expect(a).to.equal(applicantIdHash);
      expect(issuedAt).to.be.gt(0n);
      expect(revoked).to.equal(false);
    });

    it("reverts AlreadyIssued on duplicate", async () => {
      await contract.issueCertificate(applicantIdHash, fileHash);
      await expect(
        contract.issueCertificate(applicantIdHash, fileHash)
      ).to.be.revertedWithCustomError(contract, "AlreadyIssued");
    });
  });

  // ------------------ Get Certificate ------------------
  it("reverts NotFound for unknown certificate", async () => {
    const fakeFile = h("not_exist.pdf");
    await expect(contract.getCertificate(fakeFile))
      .to.be.revertedWithCustomError(contract, "NotFound");
  });

  // ------------------ Revoke Certificate ------------------
  describe("revokeCertificate", () => {
    const applicantIdHash = h(APPLICANT_ID);
    const fileHash = h("degree.pdf");

    it("reverts NotFound if file not issued", async () => {
      await expect(contract.revokeCertificate(fileHash))
        .to.be.revertedWithCustomError(contract, "NotFound");
    });

    it("revokes successfully and blocks second revoke", async () => {
      await contract.issueCertificate(applicantIdHash, fileHash);

      const tx = await contract.revokeCertificate(fileHash);
      await expect(tx)
        .to.emit(contract, "CertificateRevoked")
        .withArgs(fileHash, anyUint64());

      const [, , revoked] = await contract.getCertificate(fileHash);
      expect(revoked).to.equal(true);

      await expect(contract.revokeCertificate(fileHash))
        .to.be.revertedWithCustomError(contract, "AlreadyRevoked");
    });
  });

  // ------------------ Approve Access ------------------
  describe("approveAccess & isApproved", () => {
    const applicantIdHash = h(APPLICANT_ID);
    const fileHash = h("training.pdf");
    const verifierIdHash = h(VERIFIER_ID);

    it("reverts NotFound if cert missing", async () => {
      await expect(contract.approveAccess(fileHash, verifierIdHash))
        .to.be.revertedWithCustomError(contract, "NotFound");
    });

    it("reverts CertIsRevoked if cert is revoked", async () => {
      await contract.issueCertificate(applicantIdHash, fileHash);
      await contract.revokeCertificate(fileHash);
      await expect(contract.approveAccess(fileHash, verifierIdHash))
        .to.be.revertedWithCustomError(contract, "CertIsRevoked");
    });

    it("approves access and isApproved returns true", async () => {
      await contract.issueCertificate(applicantIdHash, fileHash);

      const tx = await contract.approveAccess(fileHash, verifierIdHash);
      await expect(tx)
        .to.emit(contract, "AccessApproved")
        .withArgs(fileHash, verifierIdHash, applicantIdHash, anyUint64());

      expect(await contract.isApproved(fileHash, verifierIdHash)).to.equal(true);
    });

    it("isApproved returns false for missing / revoked / not-approved", async () => {
      const fakeFile = h("random.pdf");
      expect(await contract.isApproved(fakeFile, verifierIdHash)).to.equal(false);

      await contract.issueCertificate(applicantIdHash, fileHash);
      expect(await contract.isApproved(fileHash, verifierIdHash)).to.equal(false);

      await contract.revokeCertificate(fileHash);
      expect(await contract.isApproved(fileHash, verifierIdHash)).to.equal(false);
    });
  });

  // ------------------ Approve Access Batch ------------------
  describe("approveAccessBatch", () => {
    const verifierIdHash = h(VERIFIER_ID);

    it("approves valid certs, skips revoked/missing", async () => {
      const a1 = h(APPLICANT_ID);
      const a2 = h("2222222222");
      const fh1 = h("cert1.pdf"); // valid
      const fh2 = h("cert2.pdf"); // revoked
      const fh3 = h("cert3.pdf"); // never issued

      await contract.issueCertificate(a1, fh1);
      await contract.issueCertificate(a2, fh2);
      await contract.revokeCertificate(fh2);

      const tx = await contract.approveAccessBatch([fh1, fh2, fh3], verifierIdHash);

      // Expect event only for fh1
      await expect(tx).to.emit(contract, "AccessApproved").withArgs(fh1, verifierIdHash, a1, anyUint64());

      // State checks
      expect(await contract.isApproved(fh1, verifierIdHash)).to.equal(true);
      expect(await contract.isApproved(fh2, verifierIdHash)).to.equal(false);
      expect(await contract.isApproved(fh3, verifierIdHash)).to.equal(false);
    });
  });
});

// ------------------------------------------------------
// Helper: matcher for any uint64 timestamp
// ------------------------------------------------------
function anyUint64() {
  return (value) => {
    try {
      const n = BigInt(value);
      return n > 0n && n < 2n ** 64n;
    } catch {
      return false;
    }
  };
}
