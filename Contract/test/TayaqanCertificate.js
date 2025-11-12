// test/TayaqanCertificate.unit.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

// helpers
const H = (s) => ethers.keccak256(ethers.toUtf8Bytes(s));

describe("TayaqanCertificate (unit)", function () {
  let owner, other, cert;
  const APP1 = H("applicant-1118997672"); // example applicant id hash preimage
  const A1 = ethers.keccak256(ethers.toUtf8Bytes("1118997672")); // applicantIdHash
  const H1 = H("file-1.pdf");
  const H2 = H("file-2.pdf");
  const HX = H("missing.pdf");

  beforeEach(async () => {
    [owner, other] = await ethers.getSigners();
    cert = await ethers.deployContract("TayaqanCertificate", [owner.address]);
    await cert.waitForDeployment();
  });

  it("SC-001 Deploy sets owner", async () => {
    expect(await cert.owner()).to.equal(owner.address);
  });

  it("SC-002 Issue success + event", async () => {
    await expect(cert.issueCertificate(A1, H1))
      .to.emit(cert, "CertificateIssued")
      .withArgs(A1, H1, anyUint64());
    const c = await cert.getCertificate(H1);
    expect(c.applicantIdHash).to.equal(A1);
    expect(c.issuedAt).to.be.gt(0n);
    expect(c.revoked).to.equal(false);
  });

  it("SC-003 Duplicate issue blocked", async () => {
    await cert.issueCertificate(A1, H1);
    await expect(cert.issueCertificate(A1, H1))
      .to.be.revertedWithCustomError(cert, "AlreadyIssued");
  });

  it("SC-004 Revoke success + event", async () => {
    await cert.issueCertificate(A1, H1);
    await expect(cert.revokeCertificate(H1))
      .to.emit(cert, "CertificateRevoked")
      .withArgs(H1, anyUint64());
    const c = await cert.getCertificate(H1);
    expect(c.revoked).to.equal(true);
  });

  it("SC-005 Revoke missing blocked", async () => {
    await expect(cert.revokeCertificate(HX))
      .to.be.revertedWithCustomError(cert, "NotFound");
  });

  it("SC-006 Revoke twice blocked", async () => {
    await cert.issueCertificate(A1, H1);
    await cert.revokeCertificate(H1);
    await expect(cert.revokeCertificate(H1))
      .to.be.revertedWithCustomError(cert, "AlreadyRevoked");
  });

  it("SC-007 Read missing returns defaults", async () => {
    const c = await cert.getCertificate(HX);
    expect(c.applicantIdHash).to.equal(ethers.ZeroHash);
    expect(c.issuedAt).to.equal(0n);
    expect(c.revoked).to.equal(false);
  });

  it("SC-008 Batch read order & states", async () => {
    await cert.issueCertificate(A1, H1);
    await cert.issueCertificate(A1, H2);
    await cert.revokeCertificate(H2);
    const arr = await cert.getCertificatesBatch([H1, HX, H2]);
    expect(arr.length).to.equal(3);

    expect(arr[0].issuedAt).to.be.gt(0n);
    expect(arr[0].revoked).to.equal(false);

    expect(arr[1].issuedAt).to.equal(0n);
    expect(arr[1].revoked).to.equal(false);

    expect(arr[2].issuedAt).to.be.gt(0n);
    expect(arr[2].revoked).to.equal(true);
  });
});

// chai matcher helper for uint64 timestamp
function anyUint64() {
  return (v) => typeof v === "bigint" && v > 0n;
}
