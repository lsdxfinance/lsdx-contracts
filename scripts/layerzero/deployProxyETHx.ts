import { ethers } from "hardhat";
import dotenv from "dotenv";

dotenv.config();

const privateKey: string = process.env.PRIVATE_KEY || "";
const infuraKey: string = process.env.INFURA_KEY || "";

const sharedDecimals = 8;

// Goerli
const ethxAddress = '0xF4C911C395DB0b993AD2909c0135cbd4D31D89CA';
// https://layerzero.gitbook.io/docs/technical-reference/testnet/testnet-addresses
const polygonZkEVMTestNetEndpoint = '0x6aB5Ae6822647046626e83ee6dB8187151E1d5ab';
const provider = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/${infuraKey}`);

// mainnet
// const ethxAddress = '0x21eAD867C8c5181854f6f8Ce71f75b173d2Bc16A';
// const provider = new ethers.providers.JsonRpcProvider(`https://mainnet.infura.io/v3/${infuraKey}`);

const deployer = new ethers.Wallet(privateKey, provider);

async function main() {
  const ETHxProxyOFTV2Contract = await ethers.getContractFactory('ETHxProxyOFTV2');
  const ETHxProxyOFTV2 = await ETHxProxyOFTV2Contract.deploy(ethxAddress, sharedDecimals, polygonZkEVMTestNetEndpoint);
  console.log(`Deployed ETHxProxyOFTV2 to ${ETHxProxyOFTV2.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
