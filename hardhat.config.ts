import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-gas-reporter";
import '@nomicfoundation/hardhat-ethers';
import '@typechain/hardhat';
import "hardhat-tracer"

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    } 
  }
};

export default config;