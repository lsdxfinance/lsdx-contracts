import { ethers } from "hardhat";
import dotenv from "dotenv";

dotenv.config();

// Polygon zkEVM Testnet
// https://layerzero.gitbook.io/docs/technical-reference/testnet/testnet-addresses
// const polygonZkEVMTestNetEndpoint = '0x6aB5Ae6822647046626e83ee6dB8187151E1d5ab';

// Optimism Goerli
const opGoerliEndpoint = '0xae92d5aD7583AD66E49A0c67BAd18F6ba52dDDc1';

// mainnet

async function main() {
  const ETHxOFTV2Contract = await ethers.getContractFactory('ETHxOFT');
  const ETHxOFT = await ETHxOFTV2Contract.deploy(opGoerliEndpoint);
  // const ETHxOFT = await ETHxOFTV2Contract.deploy(polygonZkEVMTestNetEndpoint);
  console.log(`Deployed ETHxProxyOFT to ${ETHxOFT.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
