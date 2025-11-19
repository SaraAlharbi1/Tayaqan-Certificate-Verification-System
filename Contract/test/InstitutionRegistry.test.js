const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("InstitutionRegistry", function () {
  let registry;
  let admin, institution1, institution2, user;
  let certificateContract;

  beforeEach(async function () {
    // Get signers
    [admin, institution1, institution2, user] = await ethers.getSigners();

    // Deploy InstitutionRegistry
    const InstitutionRegistry = await ethers.getContractFactory("InstitutionRegistry");
    registry = await InstitutionRegistry.deploy();
    await registry.waitForDeployment();

    // Deploy a dummy certificate contract for testing
    const CertificateRegistry = await ethers.getContractFactory("CertificateRegistry");
    certificateContract = await CertificateRegistry.deploy(institution1.address);
    await certificateContract.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct admin", async function () {
      expect(await registry.admin()).to.equal(admin.address);
    });
  });

  describe("Register Institution", function () {
    it("Should register a new institution", async function () {
      await registry.registerInstitution(
        "KSU-001",
        "King Saud University",
        await certificateContract.getAddress(),
        institution1.address
      );

      const [name, certContract, wallet, isActive] = await registry.getInstitution("KSU-001");
      
      expect(name).to.equal("King Saud University");
      expect(certContract).to.equal(await certificateContract.getAddress());
      expect(wallet).to.equal(institution1.address);
      expect(isActive).to.be.true;
    });

    it("Should emit InstitutionRegistered event", async function () {
      await expect(
        registry.registerInstitution(
          "KSU-001",
          "King Saud University",
          await certificateContract.getAddress(),
          institution1.address
        )
      )
        .to.emit(registry, "InstitutionRegistered")
        .withArgs("KSU-001", "King Saud University", await certificateContract.getAddress());
    });

    it("Should fail if not called by admin", async function () {
      await expect(
        registry.connect(user).registerInstitution(
          "KSU-001",
          "King Saud University",
          await certificateContract.getAddress(),
          institution1.address
        )
      ).to.be.revertedWith("Only admin");
    });
  });

  describe("Get Institution", function () {
    beforeEach(async function () {
      await registry.registerInstitution(
        "KSU-001",
        "King Saud University",
        await certificateContract.getAddress(),
        institution1.address
      );
    });

    it("Should return correct institution details", async function () {
      const [name, certContract, wallet, isActive] = await registry.getInstitution("KSU-001");
      
      expect(name).to.equal("King Saud University");
      expect(isActive).to.be.true;
    });

    it("Should be callable by anyone", async function () {
      const [name] = await registry.connect(user).getInstitution("KSU-001");
      expect(name).to.equal("King Saud University");
    });
  });
});