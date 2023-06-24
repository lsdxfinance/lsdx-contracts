import { ethers } from "hardhat";
import dotenv from "dotenv";

dotenv.config();

const initialSupply = 0;
const sharedDecimals = 8;

// Goerli
// https://layerzero.gitbook.io/docs/technical-reference/testnet/testnet-addresses
const polygonZkEVMTestNetEndpoint = '0x6aB5Ae6822647046626e83ee6dB8187151E1d5ab';

// mainnet

async function main() {
  const ETHxOFTV2Contract = await ethers.getContractFactory('ETHxOFTV2');
  const ETHxOFTV2 = await ETHxOFTV2Contract.deploy(polygonZkEVMTestNetEndpoint, initialSupply, sharedDecimals);
  console.log(`Deployed ETHxProxyOFTV2 to ${ETHxOFTV2.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
