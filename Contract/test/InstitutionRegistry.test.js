/**
 * InstitutionRegistry - Unit Tests
 * Run: npx hardhat test test/InstitutionRegistry.test.js
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("InstitutionRegistry", function () {
  let registry, admin, institution, randomUser;

  beforeEach(async function () {
    [admin, institution, randomUser] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("InstitutionRegistry");
    registry = await Factory.deploy();
  });

  it("Should set deployer as admin", async function () {
    expect(await registry.admin()).to.equal(admin.address);
  });

  it("Should allow admin to register institution", async function () {
    const contractAddr = ethers.Wallet.createRandom().address;
    await registry.registerInstitution("INST001", "King Saud University", contractAddr, institution.address);
    
    const [name, contract, wallet, isActive] = await registry.getInstitution("INST001");
    
    expect(name).to.equal("King Saud University");
    expect(contract).to.equal(contractAddr);
    expect(wallet).to.equal(institution.address);
    expect(isActive).to.equal(true);
  });

  it("Should reject non-admin from registering", async function () {
    await expect(
      registry.connect(randomUser).registerInstitution("INST001", "Test", institution.address, institution.address)
    ).to.be.revertedWith("Only admin");
  });

  it("Should emit InstitutionRegistered event", async function () {
    const contractAddr = ethers.Wallet.createRandom().address;
    await expect(registry.registerInstitution("INST001", "Test Uni", contractAddr, institution.address))
      .to.emit(registry, "InstitutionRegistered");
  });

  it("Should return empty for non-existent institution", async function () {
    const [name, , , isActive] = await registry.getInstitution("FAKE");
    expect(name).to.equal("");
    expect(isActive).to.equal(false);
  });
});