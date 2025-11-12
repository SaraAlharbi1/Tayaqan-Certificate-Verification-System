// hardhat.config.js
require("dotenv").config();
require("hardhat-deploy");
require("hardhat-gas-reporter");
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: false, runs: 1200 },
    },
  },
  namedAccounts: { deployer: { default: 0 } },
  networks: {
    hardhat: {},
    localhost: { url: "http://127.0.0.1:8545" },
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    coinmarketcap: process.env.CMC_KEY,
    gasPrice: 20,
    showTimeSpent: true,
  },
};
