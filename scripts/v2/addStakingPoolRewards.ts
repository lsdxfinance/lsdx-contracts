import * as _ from 'lodash';
import dotenv from "dotenv";
import { ethers } from "hardhat";
import { StakingPoolFactory__factory, LsdCoin__factory, EsLSD__factory } from '../../typechain';

const { BigNumber } = ethers;

dotenv.config();

const privateKey: string = process.env.PRIVATE_KEY || "";
const infuraKey: string = process.env.INFURA_KEY || "";

// Goerli
const provider = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/${infuraKey}`);
const lsdCoinAddress = '0x6a45C5515CD20905e6A971A3185D82E8988aA826';
const eslsdCoinAddress = '0x1BE8E518Bd954F782fA22497ee746C520b472F52';
const stakingPoolFactoryContractAddress = '0x99f595A48EF642bf1B16b485D84C12715790a825';

const pools = [
  {
    stakingTokenName: 'swETHx',
    stakingTokenAddress: '0x1B99Ad576AF352A8BF02397AA4A6860E44DE7690',
    rewards: expandTo18Decimals(7_000)
  },
  {
    stakingTokenName: 'vETHx',
    stakingTokenAddress: '0x0Ad7d395A9E2bD403a64F9fe208Bf77B5A46551B',
    rewards: expandTo18Decimals(7_000)
  }
];

// mainnet
// const provider = new ethers.providers.JsonRpcProvider(`https://mainnet.infura.io/v3/${infuraKey}`);
// const lsdCoinAddress = '0xfAC77A24E52B463bA9857d6b758ba41aE20e31FF';
// const stakingPoolFactoryContractAddress = '0x3B4b6B14d07A645005658E6Ea697edb0BD7bf2b1';

// const pools = [
//   {
//     stakingTokenName: 'swETHx',
//     stakingTokenAddress: '',
//     rewards: expandTo18Decimals(7_000)
//   },
//   {
//     stakingTokenName: 'vETHx',
//     stakingTokenAddress: '',
//     rewards: expandTo18Decimals(7_000)
//   }
// ];

function expandTo18Decimals(n: number) {
  return BigNumber.from(n).mul(BigNumber.from(10).pow(18));
}

async function main() {
  const lsdToken = LsdCoin__factory.connect(lsdCoinAddress, provider);
  const eslsdToken = EsLSD__factory.connect(eslsdCoinAddress, provider);
  const stakingPoolFactory = StakingPoolFactory__factory.connect(stakingPoolFactoryContractAddress, provider);

  const admin = new ethers.Wallet(privateKey, provider);

  let totalRewards = BigNumber.from(0);
  for (let i = 0; i < _.size(pools); i++) {
    totalRewards = totalRewards.add(pools[i].rewards);
  }
  console.log(`Adding total rewards ${ethers.utils.formatUnits(totalRewards, 18)} to ${_.size(pools)} pools`);

  // Convert total rewards to eSLSD
  console.log(`Converting $LSD to $esLSD`);
  let trans = await lsdToken.connect(admin).approve(eslsdToken.address, totalRewards);
  await trans.wait();
  console.log(`Approved $esLSD to spend $LSD`);
  trans = await eslsdToken.connect(admin).escrow(totalRewards);
  await trans.wait();
  console.log(`Escrowed $LSD to $esLSD`);

  // Approve staking pool factory to spend tokens
  const approveTrans = await eslsdToken.connect(admin).approve(stakingPoolFactory.address, totalRewards);
  await approveTrans.wait();
  console.log(`Approved staking pool factory to spend $esLSD`);

  for (let i = 0; i < _.size(pools); i++) {
    const pool = pools[i];
    const trans = await stakingPoolFactory.connect(admin).addRewards(pool.stakingTokenAddress, pool.rewards);
    await trans.wait();
    console.log(`Added ${ethers.utils.formatUnits(pool.rewards, 18)} $esLSD rewards to ${pool.stakingTokenName} staking pool`);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
