import * as _ from 'lodash';
import dotenv from "dotenv";
import { ethers } from "hardhat";
import { StakingPoolFactory__factory } from '../typechain/factories/contracts/StakingPoolFactory__factory';

const dayjs = require('dayjs');

dotenv.config();

const privateKey: string = process.env.PRIVATE_KEY || "";
const infuraKey: string = process.env.INFURA_KEY || "";

// // Goerli
// const provider = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/${infuraKey}`);
// const stakingPoolFactoryContractAddress = '0x9d0206522434011D1C6F011376e57519D5C6E4Da';

// mainnet
const provider = new ethers.providers.JsonRpcProvider(`https://mainnet.infura.io/v3/${infuraKey}`);
const stakingPoolFactoryContractAddress = '0x3B4b6B14d07A645005658E6Ea697edb0BD7bf2b1';
const pools = [
  {
    stakingTokenName: 'ETH',
    stakingTokenAddress: '0x0000000000000000000000000000000000000000',
    startTime: dayjs('2023-03-16T09:00:00.000Z'), // UTC time
    roundDurationInDays: 7
  },
  {
    stakingTokenName: 'stETH',
    // stakingTokenAddress: '0x1643E812aE58766192Cf7D2Cf9567dF2C37e9B7F', // Goerli
    stakingTokenAddress: '0xae7ab96520de3a18e5e111b5eaab095312d7fe84',
    startTime: dayjs('2023-03-16T09:00:00.000Z'), // UTC time
    roundDurationInDays: 7
  },
  {
    stakingTokenName: 'frxETH',
    // stakingTokenAddress: '0x6Bc98c23e1b72e5aA4b627f814c475071FF2dB47', // Goerli
    stakingTokenAddress: '0x5E8422345238F34275888049021821E8E08CAa1f',
    startTime: dayjs('2023-03-16T09:00:00.000Z'), // UTC time
    roundDurationInDays: 7
  },
  {
    stakingTokenName: 'rETH',
    stakingTokenAddress: '0xae78736cd615f374d3085123a210448e74fc6393',
    startTime: dayjs('2023-03-16T09:00:00.000Z'), // UTC time
    roundDurationInDays: 7
  },
  {
    stakingTokenName: 'LSD-ETH UNI V2 LP',
    // stakingTokenAddress: '0x4ee39d23773Fa2caa6c9AD9aeaD67491eB2aB095', // Goerli
    stakingTokenAddress: '0x3322f41dfa379b6d3050c1e271b0b435b3ee3303',
    startTime: dayjs('2023-03-16T9:00:00.000Z'), // UTC time
    roundDurationInDays: 7
  },
];

async function main() {
  const stakingPoolFactory = StakingPoolFactory__factory.connect(stakingPoolFactoryContractAddress, provider);

  const deployer = new ethers.Wallet(privateKey, provider);

  for (let i = 0; i < _.size(pools); i++) {
    const pool = pools[i];
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
