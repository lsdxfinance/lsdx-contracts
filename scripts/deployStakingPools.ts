import * as _ from 'lodash';
import dotenv from "dotenv";
import { ethers } from "hardhat";
import { StakingPoolFactory__factory } from '../typechain/factories/contracts/StakingPoolFactory__factory';

const dayjs = require('dayjs');

dotenv.config();

const privateKey: string = process.env.PRIVATE_KEY || "";
const infuraKey: string = process.env.INFURA_KEY || "";

// TODO: Update provider url、contract addresses and pools before running script
const provider = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/${infuraKey}`);
const stakingPoolFactoryContractAddress = '0x805a54953fef803f1F47DC9B89DA039a501DDC2D';
const pools = [
  {
    stakingTokenName: 'ETH',
    stakingTokenAddress: '0x0000000000000000000000000000000000000000',
    startTime: dayjs('2023-02-23T12:00:00.000Z'), // UTC time
    roundDurationInDays: 7
  },
  {
    stakingTokenName: 'stETH',
    stakingTokenAddress: '0x1643E812aE58766192Cf7D2Cf9567dF2C37e9B7F',
    startTime: dayjs('2023-02-23T13:00:00.000Z'), // UTC time
    roundDurationInDays: 3
  }
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
