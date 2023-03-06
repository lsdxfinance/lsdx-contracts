import { ethers, upgrades } from "hardhat";

async function main() {
  const LsdCoin = await ethers.getContractFactory("LsdCoin");
  const contract = await upgrades.deployProxy(LsdCoin, []);
  console.log(`Deployed LsdCoin to ${contract.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
