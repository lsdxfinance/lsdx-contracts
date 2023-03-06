import { ethers } from "hardhat";

// TODO: Update addresses before running script
const lsdCoinAddress = '0x1EA8635Ac50564e35a93bf1f1431d057511093c6';
const wethAddress = '0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6';

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
