import { ethers } from "hardhat";

// // Goerli
// const lsdCoinAddress = '0x6a45C5515CD20905e6A971A3185D82E8988aA826';

// mainnet
const lsdCoinAddress = '0xfAC77A24E52B463bA9857d6b758ba41aE20e31FF';

async function main() {
  const LsdxFarmFactory = await ethers.getContractFactory("LsdxFarmFactory");
  const contract = await LsdxFarmFactory.deploy(lsdCoinAddress);
  console.log(`Deployed LsdxFarmFactory to ${contract.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
