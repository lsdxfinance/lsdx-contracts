import { ethers } from "hardhat";
import dotenv from "dotenv";

dotenv.config();

// Goerli
const ethxAddress = '0xE3AA29cC330c5dd28429641Dd50409553f1f4476';
// https://layerzero.gitbook.io/docs/technical-reference/testnet/testnet-addresses
const goerliEndpoint = '0xbfD2135BFfbb0B5378b56643c2Df8a87552Bfa23';

// mainnet
// const ethxAddress = '0x21eAD867C8c5181854f6f8Ce71f75b173d2Bc16A';

async function main() {
  const ETHxProxyOFTContract = await ethers.getContractFactory('ETHxProxyOFT');
  const ETHxProxyOFT = await ETHxProxyOFTContract.deploy(goerliEndpoint, ethxAddress);
  console.log(`Deployed ETHxProxyOFT to ${ETHxProxyOFT.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
