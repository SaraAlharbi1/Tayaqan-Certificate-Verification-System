module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYING INSTITUTION REGISTRY");
  console.log("=".repeat(60));
  console.log("Deployer:", deployer);
  console.log("=".repeat(60) + "\n");

  const registry = await deploy("InstitutionRegistry", {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 1,
  });

  console.log("\n" + "=".repeat(60));
  console.log("✅ DEPLOYMENT SUCCESSFUL!");
  console.log("=".repeat(60));
  console.log("InstitutionRegistry:", registry.address);
  console.log("\n" + "=".repeat(60));
  console.log("Add to backend .env:");
  console.log("=".repeat(60));
  console.log(`INSTITUTION_REGISTRY_ADDRESS=${registry.address}\n`);
};

module.exports.tags = ["InstitutionRegistry", "all"];