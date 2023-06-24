import * as _ from 'lodash';
import dotenv from "dotenv";
import { ethers } from "hardhat";
import { LsdCoin__factory, EsLSD__factory, BoostableFarm__factory } from '../../typechain';

const { BigNumber } = ethers;

dotenv.config();

const privateKey: string = process.env.PRIVATE_KEY || "";
const infuraKey: string = process.env.INFURA_KEY || "";

// Goerli
const provider = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/${infuraKey}`);
const lsdCoinAddress = '0x6a45C5515CD20905e6A971A3185D82E8988aA826';
const eslsdCoinAddress = '0x1BE8E518Bd954F782fA22497ee746C520b472F52';
const boostableFarmAddress = '0xc7Afa6cE0b1AB3161cA3c356c19BdC60D1Fe71Dc';

// mainnet
// const provider = new ethers.providers.JsonRpcProvider(`https://mainnet.infura.io/v3/${infuraKey}`);
// const lsdCoinAddress = '';
// const eslsdCoinAddress = '';
// const boostableFarmAddress = '';

function expandTo18Decimals(n: number) {
  return BigNumber.from(n).mul(BigNumber.from(10).pow(18));
}

async function main() {
  const lsdToken = LsdCoin__factory.connect(lsdCoinAddress, provider);
  const eslsdToken = EsLSD__factory.connect(eslsdCoinAddress, provider);
  const boostableFarm = BoostableFarm__factory.connect(boostableFarmAddress, provider);

  const admin = new ethers.Wallet(privateKey, provider);

  let totalRewards = expandTo18Decimals(3_000);
  let rewardPeriodInDays = 3;
  console.log(`Adding total rewards ${ethers.utils.formatUnits(totalRewards, 18)}, lasting for ${rewardPeriodInDays} days`);

  // Convert total rewards to eSLSD
  console.log(`Converting $LSD to $esLSD`);
  let trans = await lsdToken.connect(admin).approve(eslsdToken.address, totalRewards);
  await trans.wait();
  console.log(`Approved $esLSD to spend $LSD`);
  trans = await eslsdToken.connect(admin).escrow(totalRewards);
  await trans.wait();
  console.log(`Escrowed $LSD to esLSD`);

  // Approve staking pool factory to spend tokens
  const approveTrans = await eslsdToken.connect(admin).approve(boostableFarm.address, totalRewards);
  await approveTrans.wait();
  console.log(`Approved boostable farm to spend tokens`);

  trans = await boostableFarm.connect(admin).addRewards(totalRewards, rewardPeriodInDays);
  await trans.wait();
  console.log(`Added ${ethers.utils.formatUnits(totalRewards, 18)} rewards to boostable farm`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
