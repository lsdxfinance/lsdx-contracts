import { ethers } from "hardhat";

// Goerli
// const eslsdCoinAddress = '0x1BE8E518Bd954F782fA22497ee746C520b472F52';
// const wethAddress = '0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6';

// mainnet
const eslsdCoinAddress = '0x081231339BcC4061e4511d73f1697C021B461aC2';
const wethAddress = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

async function main() {
  const StakingPoolFactory = await ethers.getContractFactory("StakingPoolFactory");
  const contract = await StakingPoolFactory.deploy(eslsdCoinAddress, wethAddress);
  console.log(`Deployed StakingPoolFactory to ${contract.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
