import dotenv from "dotenv";
import { ethers } from "hardhat";
import { StafiStorage__factory, StafiUpgrade__factory  } from '../../typechain';

dotenv.config();

const privateKey: string = process.env.PRIVATE_KEY || "";
const infuraKey: string = process.env.INFURA_KEY || "";

const provider = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/${infuraKey}`);

/**
 * Deployed StafiStorage to 0xfA32ab0249480BBC21a368e8e539874571e90753
 * Deployed StafiUpgrade to 0x2ba93eb0a2898303c66e79bb33fabc83b39a06b9
 * Deployed StafiEther to 0x34c10C8A7b68F0411708829F61AFF02209E34D27
 * Deployed StafiNetworkBalances to 0x504432D6a4F49fE8446e79064ef4e4dD74e29aD2
 * Deployed StafiUserDeposit to 0xe9cb1226cdD73EE8723a3B51f66387a93F97F5EB
 * Deployed RETHToken to 0xC118e5AeFd1de98a1d88498988D0d048dF11D66E
 */
async function main() {
  const admin = new ethers.Wallet(privateKey, provider);

  const StafiStorage = await ethers.getContractFactory('StafiStorage');
  const StafiStorageContract = await StafiStorage.deploy();
  const stafiStorage = StafiStorage__factory.connect(StafiStorageContract.address, provider);
  console.log(`Deployed StafiStorage to ${stafiStorage.address}`);

  const StafiUpgrade = await ethers.getContractFactory('StafiUpgrade');
  const StafiUpgradeContract = await StafiUpgrade.deploy(stafiStorage.address);
  const stafiUpgrade = StafiUpgrade__factory.connect(StafiUpgradeContract.address, provider);
  console.log(`Deployed StafiUpgrade to ${stafiUpgrade.address}`);
  let trans = await stafiUpgrade.connect(admin).initThisContract();
  await trans.wait();

  const StafiEther = await ethers.getContractFactory('StafiEther');
  const StafiEtherContract = await StafiEther.deploy(stafiStorage.address);
  console.log(`Deployed StafiEther to ${StafiEtherContract.address}`);
  trans = await stafiUpgrade.connect(admin).addContract("stafiEther", StafiEtherContract.address);
  await trans.wait();

  const StafiNetworkBalances = await ethers.getContractFactory('StafiNetworkBalances');
  const StafiNetworkBalancesContract = await StafiNetworkBalances.deploy(stafiStorage.address);
  console.log(`Deployed StafiNetworkBalances to ${StafiNetworkBalancesContract.address}`);
  trans = await stafiUpgrade.connect(admin).addContract("stafiNetworkBalances", StafiNetworkBalancesContract.address);
  await trans.wait();

  const StafiUserDeposit = await ethers.getContractFactory('StafiUserDeposit');
  const StafiUserDepositContract = await StafiUserDeposit.deploy(stafiStorage.address);
  console.log(`Deployed StafiUserDeposit to ${StafiUserDepositContract.address}`);
  trans = await stafiUpgrade.connect(admin).addContract("stafiUserDeposit", StafiUserDepositContract.address);
  await trans.wait();

  const RETHToken = await ethers.getContractFactory('RETHToken');
  const RETHTokenContract = await RETHToken.deploy(stafiStorage.address);
  console.log(`Deployed RETHToken to ${RETHTokenContract.address}`);
  trans = await stafiUpgrade.connect(admin).addContract("rETHToken", RETHTokenContract.address);
  await trans.wait();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
