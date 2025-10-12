require("dotenv").config();
require("hardhat-deploy");
require("@nomicfoundation/hardhat-ethers");
require("hardhat-gas-reporter");
require("@nomicfoundation/hardhat-chai-matchers");


module.exports = {
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 1000 } },
  },
  namedAccounts: { deployer: { default: 0 } },
  networks: {
    hardhat: {},
    localhost: { url: "http://127.0.0.1:8545" },
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    coinmarketcap: process.env.CMC_KEY, // <— move the key to .env
    gasPrice: 20,
    showTimeSpent: true,
  },
};
