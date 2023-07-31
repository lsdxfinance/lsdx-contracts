import * as _ from 'lodash';
import dotenv from "dotenv";
import { ethers } from "hardhat";
import { StakingPoolFactory__factory } from '../../typechain';

const dayjs = require('dayjs');

dotenv.config();

const privateKey: string = process.env.PRIVATE_KEY || "";
const infuraKey: string = process.env.INFURA_KEY || "";

// // Goerli
// const provider = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/${infuraKey}`);
// const stakingPoolFactoryContractAddress = '0x99f595A48EF642bf1B16b485D84C12715790a825';
// const pools = [
//   {
//     stakingTokenName: 'swETHx',
//     stakingTokenAddress: '0x1B99Ad576AF352A8BF02397AA4A6860E44DE7690',
//     startTime: dayjs('2023-06-25T07:36:00.000Z'), // UTC time
//     roundDurationInDays: 7
//   },
//   {
//     stakingTokenName: 'vETHx',
//     stakingTokenAddress: '0x0Ad7d395A9E2bD403a64F9fe208Bf77B5A46551B',
//     startTime: dayjs('2023-06-25T07:38:00.000Z'), // UTC time
//     roundDurationInDays: 7
//   },
// ];

// mainnet
const provider = new ethers.providers.JsonRpcProvider(`https://mainnet.infura.io/v3/${infuraKey}`);
const stakingPoolFactoryContractAddress = '0xb63805Cf638e95e4D7032BB09FD0c1E7028e9B50';
const pools = [
  {
    stakingTokenName: 'swETHx',
    stakingTokenAddress: '0xEeda0FD97340796C2295296d6fE9826F32E8fDdD',
    startTime: dayjs('2023-07-31T08:40:00.000Z'), // UTC time
    roundDurationInDays: 7
  },
  {
    stakingTokenName: 'vETHx',
    stakingTokenAddress: '0x71fa8A6C674400D851F5d9FFe22f0a08802530D0',
    startTime: dayjs('2023-07-31T08:40:00.000Z'), // UTC time
    roundDurationInDays: 7
  },
];

async function main() {
  const stakingPoolFactory = StakingPoolFactory__factory.connect(stakingPoolFactoryContractAddress, provider);

  const deployer = new ethers.Wallet(privateKey, provider);

  for (let i = 0; i < _.size(pools); i++) {
    const pool = pools[i];
    // console.log(pool.startTime.unix());
    const trans = await stakingPoolFactory.connect(deployer).deployPool(pool.stakingTokenAddress, pool.startTime.unix(), pool.roundDurationInDays);
    await trans.wait();
    console.log(`Deployed staking pool for ${pool.stakingTokenName}`);
    console.log(`\t\tPool Address: ${await stakingPoolFactory.getStakingPoolAddress(pool.stakingTokenAddress)}`);
    console.log(`\t\tStart timestamp: ${pool.startTime.unix()}`);
    console.log(`\t\tRound duration (days): ${pool.roundDurationInDays}`);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
