import { ethers } from "hardhat";

// // Goerli
// const lsdCoinAddress = '0x6a45C5515CD20905e6A971A3185D82E8988aA826';
// const wethAddress = '0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6';

// mainnet
const lsdCoinAddress = '';
const wethAddress = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

async function main() {
  const StakingPoolFactory = await ethers.getContractFactory("StakingPoolFactory");
  const contract = await StakingPoolFactory.deploy(lsdCoinAddress, wethAddress);
  console.log(`Deployed StakingPoolFactory to ${contract.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
