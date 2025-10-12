module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  // Deploy your TayaqanCertificate contract
  const res = await deploy("TayaqanCertificate", {
    from: deployer,
    args: [deployer], // constructor(address initialOwner)
    log: true,
    waitConfirmations: 1,
  });

  log(`✅ TayaqanCertificate deployed at: ${res.address}`);
};

module.exports.tags = ["Tayaqan"];
