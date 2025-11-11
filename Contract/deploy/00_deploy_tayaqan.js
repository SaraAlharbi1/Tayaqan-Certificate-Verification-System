// contract/deploy/00_deploy_tayaqan.js
const fs = require("fs");
const path = require("path");

module.exports = async ({ getNamedAccounts, deployments, network }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const res = await deploy("TayaqanCertificate", {
    from: deployer,
    args: [deployer],            // constructor(address initialOwner)
    log: true,
    waitConfirmations: network.live ? 3 : 1,
  });

  log(`✅ TayaqanCertificate deployed at: ${res.address}`);

  // Resolve start block from saved deployment (works on reuse)
  const depFile = path.join(__dirname, "..", "deployments", network.name, "TayaqanCertificate.json");
  let startBlock = 0;
  try {
    const art = JSON.parse(fs.readFileSync(depFile, "utf8"));
    startBlock = art?.receipt?.blockNumber ?? 0;
  } catch (_) {
    startBlock = 0;
  }

  // Minimal meta file for other tools (optional)
  const meta = {
    network: network.name,
    address: res.address,
    startBlock,
    abiPath: `deployments/${network.name}/TayaqanCertificate.json`,
  };
  const metaPath = path.join(__dirname, "..", "deployments", network.name, "txinfo.meta.json");
  try { fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2)); } catch (_) {}

  // Print lines you can copy into backend .env
  log("----- backend ENV -----");
  log(`CONTRACT_ADDRESS=${res.address}`);
  log(`CERTIFICATE_ABI_PATH=${meta.abiPath}`);
  log(`TXINFO_START_BLOCK=${startBlock}`);
  log("-----------------------");
};

module.exports.tags = ["Tayaqan"];
