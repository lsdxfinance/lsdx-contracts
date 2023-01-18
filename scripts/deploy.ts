import { ethers, upgrades } from "hardhat";

async function main() {
  const FlyCoin = await ethers.getContractFactory("FlyCoin");
  const contract = await upgrades.deployProxy(FlyCoin, []);
  console.log(`Deployed FlyCoin to ${contract.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
