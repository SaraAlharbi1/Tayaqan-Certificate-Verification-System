// test/TayaqanCertificate.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

// helper: keccak256("...") -> bytes32
const h = (s) => ethers.keccak256(ethers.toUtf8Bytes(s));

describe("TayaqanCertificate", function () {
  async function deployFixture() {
    const [owner, other, third] = await ethers.getSigners();
    const F = await ethers.getContractFactory("TayaqanCertificate");
    const c = await F.deploy(owner.address);
    return {
      c,
      owner,
      other,
      third,
      AID: h("applicant-1118997672"),
      F1: h("file-1"),
      F2: h("file-2"),
    };
  }

  // ---------------- Deployment ----------------
  describe("Deployment", function () {
    it("sets the right owner", async () => {
      const { c, owner } = await loadFixture(deployFixture);
      expect(await c.owner()).to.equal(owner.address);
    });

    it("starts with empty state", async () => {
      const { c, F1 } = await loadFixture(deployFixture);
      await expect(c.getCertificate(F1))
        .to.be.revertedWithCustomError(c, "NotFound");
    });
  });

  // ---------------- issueCertificate ----------------
  describe("issueCertificate", function () {
    it("issues successfully", async () => {
      const { c, AID, F1 } = await loadFixture(deployFixture);
      const tx = await c.issueCertificate(AID, F1);
      const rc = await tx.wait();
      const blk = await ethers.provider.getBlock(rc.blockNumber);

      const cert = await c.certByFileHash(F1);
      expect(cert.applicantIdHash).to.equal(AID);
      expect(cert.issuedAt).to.equal(blk.timestamp);
      expect(cert.revoked).to.equal(false);
    });

    it("emits CertificateIssued", async () => {
      const { c, AID, F1 } = await loadFixture(deployFixture);
      await expect(c.issueCertificate(AID, F1))
        .to.emit(c, "CertificateIssued")
        .withArgs(AID, F1, anyValue); // do NOT assert exact timestamp
    });

    it("reverts on duplicate", async () => {
      const { c, AID, F1 } = await loadFixture(deployFixture);
      await c.issueCertificate(AID, F1);
      await expect(c.issueCertificate(AID, F1))
        .to.be.revertedWithCustomError(c, "AlreadyIssued");
    });

    it("only owner can issue", async () => {
      const { c, other, AID, F1 } = await loadFixture(deployFixture);
      await expect(c.connect(other).issueCertificate(AID, F1))
        .to.be.revertedWithCustomError(c, "OwnableUnauthorizedAccount");
    });

    it("allows multiple different certificates", async () => {
      const { c, AID, F1, F2 } = await loadFixture(deployFixture);
      await c.issueCertificate(AID, F1);
      await c.issueCertificate(AID, F2);
      const c1 = await c.certByFileHash(F1);
      const c2 = await c.certByFileHash(F2);
      expect(c1.issuedAt).to.be.gt(0);
      expect(c2.issuedAt).to.be.gt(0);
    });
  });

  // ---------------- revokeCertificate ----------------
  describe("revokeCertificate", function () {
    it("revokes successfully", async () => {
      const { c, AID, F1 } = await loadFixture(deployFixture);
      await c.issueCertificate(AID, F1);
      await c.revokeCertificate(F1);
      const cert = await c.certByFileHash(F1);
      expect(cert.revoked).to.equal(true);
    });

    it("emits CertificateRevoked", async () => {
      const { c, AID, F1 } = await loadFixture(deployFixture);
      await c.issueCertificate(AID, F1);
      await expect(c.revokeCertificate(F1))
        .to.emit(c, "CertificateRevoked")
        .withArgs(F1, anyValue);
    });

    it("reverts if not found", async () => {
      const { c, F1 } = await loadFixture(deployFixture);
      await expect(c.revokeCertificate(F1))
        .to.be.revertedWithCustomError(c, "NotFound");
    });

    it("reverts if already revoked", async () => {
      const { c, AID, F1 } = await loadFixture(deployFixture);
      await c.issueCertificate(AID, F1);
      await c.revokeCertificate(F1);
      await expect(c.revokeCertificate(F1))
        .to.be.revertedWithCustomError(c, "AlreadyRevoked");
    });

    it("only owner can revoke", async () => {
      const { c, other, AID, F1 } = await loadFixture(deployFixture);
      await c.issueCertificate(AID, F1);
      await expect(c.connect(other).revokeCertificate(F1))
        .to.be.revertedWithCustomError(c, "OwnableUnauthorizedAccount");
    });

    it("keeps issuedAt after revoke", async () => {
      const { c, AID, F1 } = await loadFixture(deployFixture);
      await c.issueCertificate(AID, F1);
      const before = (await c.certByFileHash(F1)).issuedAt;
      await c.revokeCertificate(F1);
      const after = (await c.certByFileHash(F1)).issuedAt;
      expect(after).to.equal(before);
    });
  });

  // ---------------- getCertificate ----------------
  describe("getCertificate", function () {
    it("returns details", async () => {
      const { c, AID, F1 } = await loadFixture(deployFixture);
      await c.issueCertificate(AID, F1);
      const [aid, issuedAt, revoked] = await c.getCertificate(F1);
      expect(aid).to.equal(AID);
      expect(issuedAt).to.be.gt(0);
      expect(revoked).to.equal(false);
    });

    it("reverts if not found", async () => {
      const { c, F1 } = await loadFixture(deployFixture);
      await expect(c.getCertificate(F1))
        .to.be.revertedWithCustomError(c, "NotFound");
    });

    it("shows revoked status", async () => {
      const { c, AID, F1 } = await loadFixture(deployFixture);
      await c.issueCertificate(AID, F1);
      await c.revokeCertificate(F1);
      const [, , revoked] = await c.getCertificate(F1);
      expect(revoked).to.equal(true);
    });

    it("is viewable by anyone", async () => {
      const { c, other, AID, F1 } = await loadFixture(deployFixture);
      await c.issueCertificate(AID, F1);
      const [aid] = await c.connect(other).getCertificate(F1);
      expect(aid).to.equal(AID);
    });
  });

  // ---------------- isCertificateValid ----------------
  describe("isCertificateValid", function () {
    it("true for valid", async () => {
      const { c, AID, F1 } = await loadFixture(deployFixture);
      await c.issueCertificate(AID, F1);
      expect(await c.isCertificateValid(F1)).to.equal(true);
    });

    it("false for missing", async () => {
      const { c } = await loadFixture(deployFixture);
      expect(await c.isCertificateValid(h("never-issued"))).to.equal(false);
    });

    it("false for revoked", async () => {
      const { c, AID, F1 } = await loadFixture(deployFixture);
      await c.issueCertificate(AID, F1);
      await c.revokeCertificate(F1);
      expect(await c.isCertificateValid(F1)).to.equal(false);
    });

    it("viewable by anyone", async () => {
      const { c, other } = await loadFixture(deployFixture);
      expect(await c.connect(other).isCertificateValid(h("x"))).to.equal(false);
    });
  });

  // ---------------- getCertificatesBatch ----------------
  describe("getCertificatesBatch", function () {
    it("returns multiple", async () => {
      const { c, AID } = await loadFixture(deployFixture);
      const f1 = h("b1"), f2 = h("b2");
      await c.issueCertificate(AID, f1);
      await c.issueCertificate(AID, f2);
      const arr = await c.getCertificatesBatch([f1, f2]);
      expect(arr.length).to.equal(2);
      expect(arr[0].issuedAt).to.be.gt(0);
      expect(arr[1].issuedAt).to.be.gt(0);
    });

    it("empty entries for missing hashes", async () => {
      const { c, AID } = await loadFixture(deployFixture);
      const f1 = h("mm1"), f2 = h("mm2");
      await c.issueCertificate(AID, f1);
      const arr = await c.getCertificatesBatch([f1, f2]);
      expect(arr[0].issuedAt).to.be.gt(0);   // present
      expect(arr[1].issuedAt).to.equal(0);   // missing
      expect(arr[1].revoked).to.equal(false);
    });

    it("mixed valid/missing", async () => {
      const { c, AID } = await loadFixture(deployFixture);
      const f1 = h("mix1"), f2 = h("mix2");
      await c.issueCertificate(AID, f1);
      const arr = await c.getCertificatesBatch([f2, f1]);
      expect(arr[0].issuedAt).to.equal(0);
      expect(arr[1].issuedAt).to.be.gt(0);
    });

    it("shows revoked correctly", async () => {
      const { c, AID } = await loadFixture(deployFixture);
      const f1 = h("rv1"), f2 = h("rv2");
      await c.issueCertificate(AID, f1);
      await c.issueCertificate(AID, f2);
      await c.revokeCertificate(f1);
      const arr = await c.getCertificatesBatch([f1, f2]);
      expect(arr[0].revoked).to.equal(true);
      expect(arr[1].revoked).to.equal(false);
    });

    it("handles empty input", async () => {
      const { c } = await loadFixture(deployFixture);
      const arr = await c.getCertificatesBatch([]);
      expect(arr.length).to.equal(0);
    });

    it("handles larger batch (10)", async () => {
      const { c, AID } = await loadFixture(deployFixture);
      const hashes = Array.from({ length: 10 }, (_, i) => h("L" + i));
      for (const x of hashes) await c.issueCertificate(AID, x);
      const arr = await c.getCertificatesBatch(hashes);
      expect(arr.length).to.equal(10);
      for (const e of arr) expect(e.issuedAt).to.be.gt(0);
    });

    it("is viewable by anyone", async () => {
      const { c, other, AID } = await loadFixture(deployFixture);
      const f1 = h("vv1");
      await c.issueCertificate(AID, f1);
      const arr = await c.connect(other).getCertificatesBatch([f1]);
      expect(arr.length).to.equal(1);
      expect(arr[0].issuedAt).to.be.gt(0);
    });
  });

  // ---------------- Ownership ----------------
  describe("Ownership", function () {
    it("transfers ownership", async () => {
      const { c, owner, other } = await loadFixture(deployFixture);
      await c.transferOwnership(other.address);
      expect(await c.owner()).to.equal(other.address);
      await expect(c.connect(owner).issueCertificate(h("a"), h("b")))
        .to.be.revertedWithCustomError(c, "OwnableUnauthorizedAccount");
    });

    it("new owner can issue", async () => {
      const { c, other } = await loadFixture(deployFixture);
      await c.transferOwnership(other.address);
      await c.connect(other).issueCertificate(h("aid"), h("fh"));
      expect((await c.certByFileHash(h("fh"))).issuedAt).to.be.gt(0);
    });

    it("old owner blocked after transfer", async () => {
      const { c, owner, other } = await loadFixture(deployFixture);
      await c.transferOwnership(other.address);
      await expect(c.connect(owner).revokeCertificate(h("x")))
        .to.be.revertedWithCustomError(c, "OwnableUnauthorizedAccount");
    });
  });

  // ---------------- Gas (simple bounds) ----------------
  describe("Gas", function () {
    it("issueCertificate < 100k", async () => {
      const { c } = await loadFixture(deployFixture);
      const tx = await c.issueCertificate(h("aidG"), h("fhG"));
      const rc = await tx.wait();
      expect(rc.gasUsed).to.be.lt(100_000);
    });

    it("revokeCertificate < 50k", async () => {
      const { c } = await loadFixture(deployFixture);
      await c.issueCertificate(h("aidR"), h("fhR"));
      const tx = await c.revokeCertificate(h("fhR"));
      const rc = await tx.wait();
      expect(rc.gasUsed).to.be.lt(50_000);
    });
  });

  // ---------------- Edge Cases ----------------
  describe("Edge Cases", function () {
    it("accepts zero bytes32", async () => {
      const { c } = await loadFixture(deployFixture);
      await c.issueCertificate(h("0aid"), ethers.ZeroHash);
      expect((await c.certByFileHash(ethers.ZeroHash)).issuedAt).to.be.gt(0);
    });

    it("issuedAt fits uint64", async () => {
      const { c } = await loadFixture(deployFixture);
      await c.issueCertificate(h("aid64"), h("fh64"));
      const x = await c.certByFileHash(h("fh64"));
      // just sanity: value is a BigInt and not zero; do not assert exact timestamp
      expect(x.issuedAt).to.be.gt(0);
    });

    it("different file hashes are distinct", async () => {
      const { c } = await loadFixture(deployFixture);
      const f1 = h("d1"), f2 = h("d2");
      await c.issueCertificate(h("aidD"), f1);
      await c.issueCertificate(h("aidD"), f2);
      const c1 = await c.certByFileHash(f1);
      const c2 = await c.certByFileHash(f2);
      expect(c1.issuedAt).to.not.equal(c2.issuedAt);
    });
  });
});