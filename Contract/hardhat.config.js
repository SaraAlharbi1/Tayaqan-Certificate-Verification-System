require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,   // ✅ turn optimizer ON
        runs: 1000,       // good balance between deployment cost and runtime cost
      },
    },
  },
  gasReporter: {
    enabled: true,                     // turn gas reporter on
    currency: "USD",                   // show USD prices
    coinmarketcap: "e1f93115-915a-4e3f-a2cd-7e15fe7375f1", // your API key
    gasPrice: 20,                      // assumed gwei price (for ETH/USD calc)
    showTimeSpent: true,               // also show time per test
  },
};
