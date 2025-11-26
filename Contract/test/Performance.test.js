const { expect } = require("chai");
const { ethers } = require("hardhat");

const MAINNET_GAS_GWEI = 30;
const MAINNET_GAS_WEI = BigInt(MAINNET_GAS_GWEI * 1000000000);

describe("TAYAQAN Performance", function () {
  let institutionRegistry, certificateRegistry, deployer;
  let ethPrice = 0;

  this.timeout(14400000);

  before(async function () {
    const signers = await ethers.getSigners();
    deployer = signers[0]; // Use same account for everything
    
    // Get ETH price
    const cmcKey = process.env.CMC_KEY;
    if (!cmcKey) throw new Error("CMC_KEY not found");
    
    const response = await fetch('https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=ETH', {
      headers: { 'X-CMC_PRO_API_KEY': cmcKey }
    });
    
    const data = await response.json();
    ethPrice = data.data.ETH.quote.USD.price;

    console.log(`\n════════════════════════════════════════`);
    console.log(`DEPLOYMENT`);
    console.log(`════════════════════════════════════════\n`);

    // Deploy InstitutionRegistry
    console.log(`InstitutionRegistry:`);
    const InstReg = await ethers.getContractFactory("InstitutionRegistry");
    const start1 = Date.now();
    
    const deployTx1 = await InstReg.deploy();
    const txHash1 = deployTx1.deploymentTransaction 
      ? deployTx1.deploymentTransaction().hash 
      : deployTx1.deployTransaction.hash;
    
    institutionRegistry = await deployTx1.waitForDeployment();
    const latency1 = Date.now() - start1;
    
    const receipt1 = await ethers.provider.getTransactionReceipt(txHash1);
    
    console.log(`  Gas: ${receipt1.gasUsed}`);
    console.log(`  Cost: $${calcCost(receipt1.gasUsed).toFixed(2)}`);
    console.log(`  Latency: ${(latency1/1000).toFixed(1)}s\n`);
    
    // Deploy CertificateRegistry (use deployer for both params)
    console.log(`CertificateRegistry:`);
    const CertReg = await ethers.getContractFactory("CertificateRegistry");
    const start2 = Date.now();
    
    const deployTx2 = await CertReg.deploy(deployer.address, deployer.address);
    const txHash2 = deployTx2.deploymentTransaction 
      ? deployTx2.deploymentTransaction().hash 
      : deployTx2.deployTransaction.hash;
    
    certificateRegistry = await deployTx2.waitForDeployment();
    const latency2 = Date.now() - start2;
    
    const receipt2 = await ethers.provider.getTransactionReceipt(txHash2);
    
    console.log(`  Gas: ${receipt2.gasUsed}`);
    console.log(`  Cost: $${calcCost(receipt2.gasUsed).toFixed(2)}`);
    console.log(`  Latency: ${(latency2/1000).toFixed(1)}s\n`);
    
    const totalGas = receipt1.gasUsed + receipt2.gasUsed;
    console.log(`Total Deployment:`);
    console.log(`  Gas: ${totalGas}`);
    console.log(`  Cost: $${calcCost(totalGas).toFixed(2)}`);
    console.log(`  Latency: ${((latency1 + latency2)/1000).toFixed(1)}s\n`);
    
    // Register institution
    const certRegAddress = await certificateRegistry.getAddress();
    const regTx = await institutionRegistry.registerInstitution(
      "KAU001", "King Abdulaziz University", certRegAddress, deployer.address
    );
    await regTx.wait();
    
    console.log(`════════════════════════════════════════`);
    console.log(`OPERATIONS`);
    console.log(`════════════════════════════════════════`);
  });

  function calcCost(gasUsed) {
    const gasCostETH = Number(ethers.formatEther(gasUsed * MAINNET_GAS_WEI));
    return gasCostETH * ethPrice;
  }

  describe("Operations", function () {
    
    it("Issue Certificate", async function () {
      const start = Date.now();
      const tx = await certificateRegistry.issueCertificate(
        "QmHash1",
        ethers.keccak256(ethers.toUtf8Bytes("student1")),
        "BSc Computer Science",
        Math.floor(Date.now() / 1000)
      );
      const receipt = await tx.wait();
      const latency = Date.now() - start;
      
      console.log(`\nIssue Certificate:`);
      console.log(`  Gas: ${receipt.gasUsed}`);
      console.log(`  Cost: $${calcCost(receipt.gasUsed).toFixed(2)}`);
      console.log(`  Latency: ${(latency/1000).toFixed(1)}s`);
    });

    it("Revoke Certificate", async function () {
      const tx1 = await certificateRegistry.issueCertificate(
        "QmHash2", 
        ethers.keccak256(ethers.toUtf8Bytes("student2")), 
        "MSc", 
        Math.floor(Date.now() / 1000)
      );
      await tx1.wait();
      
      const start = Date.now();
      const tx = await certificateRegistry.revokeCertificate("QmHash2");
      const receipt = await tx.wait();
      const latency = Date.now() - start;
      
      console.log(`\nRevoke Certificate:`);
      console.log(`  Gas: ${receipt.gasUsed}`);
      console.log(`  Cost: $${calcCost(receipt.gasUsed).toFixed(2)}`);
      console.log(`  Latency: ${(latency/1000).toFixed(1)}s`);
    });

    it("Add Employer Access", async function () {
      const employerId = ethers.keccak256(ethers.toUtf8Bytes("employer1"));
      const expiry = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60);
      
      const start = Date.now();
      const tx = await certificateRegistry.addEmployerAccess("QmHash1", employerId, expiry);
      const receipt = await tx.wait();
      const latency = Date.now() - start;
      
      console.log(`\nAdd Employer Access:`);
      console.log(`  Gas: ${receipt.gasUsed}`);
      console.log(`  Cost: $${calcCost(receipt.gasUsed).toFixed(2)}`);
      console.log(`  Latency: ${(latency/1000).toFixed(1)}s`);
    });

    it("Remove Employer Access", async function () {
      const employerId = ethers.keccak256(ethers.toUtf8Bytes("employer1"));
      
      const start = Date.now();
      const tx = await certificateRegistry.removeEmployerAccess("QmHash1", employerId);
      const receipt = await tx.wait();
      const latency = Date.now() - start;
      
      console.log(`\nRemove Employer Access:`);
      console.log(`  Gas: ${receipt.gasUsed}`);
      console.log(`  Cost: $${calcCost(receipt.gasUsed).toFixed(2)}`);
      console.log(`  Latency: ${(latency/1000).toFixed(1)}s`);
    });

    it("Verify Certificate", async function () {
      const start = Date.now();
      await certificateRegistry.verifyCertificate("QmHash1");
      const latency = Date.now() - start;
      
      console.log(`\nVerify Certificate:`);
      console.log(`  Gas: 0 (FREE)`);
      console.log(`  Latency: ${latency}ms`);
    });

    it("Check Employer Access", async function () {
      const employerId = ethers.keccak256(ethers.toUtf8Bytes("employer1"));
      
      const start = Date.now();
      await certificateRegistry.checkEmployerAccess("QmHash1", employerId);
      const latency = Date.now() - start;
      
      console.log(`\nCheck Employer Access:`);
      console.log(`  Gas: 0 (FREE)`);
      console.log(`  Latency: ${latency}ms`);
    });
  });

  describe("Scalability", function () {
    
    before(function() {
      console.log(`\n════════════════════════════════════════`);
      console.log(`SCALABILITY`);
      console.log(`════════════════════════════════════════`);
    });
    
    it("100 Certificates", async function () {
      await testScale(100);
    });

    it("500 Certificates", async function () {
      await testScale(500);
    });
  });

  async function testScale(count) {
    console.log(`\n${count} Certificates:`);
    
    let totalGas = 0n;
    let totalLatency = 0;
    const startTime = Date.now();
    
    for (let i = 0; i < count; i++) {
      const start = Date.now();
      
      const tx = await certificateRegistry.issueCertificate(
        `QmScale${count}-${i}`,
        ethers.keccak256(ethers.toUtf8Bytes(`student-${count}-${i}`)),
        `Cert ${i}`,
        Math.floor(Date.now() / 1000)
      );
      const receipt = await tx.wait();
      
      totalGas += receipt.gasUsed;
      totalLatency += (Date.now() - start);
      
      const interval = count >= 500 ? 50 : (count >= 100 ? 10 : 1);
      if ((i + 1) % interval === 0 || i === count - 1) {
        const avgGas = totalGas / BigInt(i + 1);
        const avgLatency = (totalLatency / (i + 1) / 1000).toFixed(1);
        const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
        console.log(`  [${i + 1}/${count}] Avg Gas: ${avgGas} | Avg Latency: ${avgLatency}s | Elapsed: ${elapsed}min`);
      }
    }
    
    const avgGas = totalGas / BigInt(count);
    const avgLatency = totalLatency / count;
    const totalCost = calcCost(totalGas);
    
    console.log(`  Total Gas: ${totalGas}`);
    console.log(`  Avg Gas: ${avgGas}`);
    console.log(`  Total Cost: $${totalCost.toFixed(2)}`);
    console.log(`  Avg Latency: ${(avgLatency/1000).toFixed(1)}s\n`);
  }
});