import * as _ from 'lodash';
import dotenv from "dotenv";
import { ethers } from "hardhat";
import { StakingPoolFactory__factory, LsdCoin__factory } from '../typechain';

const { BigNumber } = ethers;

dotenv.config();

const privateKey: string = process.env.PRIVATE_KEY || "";
const infuraKey: string = process.env.INFURA_KEY || "";

// Goerli
// const provider = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/${infuraKey}`);
// const lsdCoinAddress = '';
// const stakingPoolFactoryContractAddress = '';

// mainnet
const provider = new ethers.providers.JsonRpcProvider(`https://mainnet.infura.io/v3/${infuraKey}`);
const lsdCoinAddress = '0xfAC77A24E52B463bA9857d6b758ba41aE20e31FF';
const stakingPoolFactoryContractAddress = '0x3B4b6B14d07A645005658E6Ea697edb0BD7bf2b1';

const pools = [
  {
    stakingTokenName: 'ETHx',
    stakingTokenAddress: '0x21eAD867C8c5181854f6f8Ce71f75b173d2Bc16A',
    rewards: expandTo18Decimals(875_000)
  },
  {
    stakingTokenName: 'ETHx/ETH UNI LP',
    stakingTokenAddress: '0x3ab2ebBe52F4A80098A461cF9ECdAde2eD645fc4',
    rewards: expandTo18Decimals(525_000)
  },
  {
    stakingTokenName: 'LSD/ETH UNI LP',
    stakingTokenAddress: '0x3322f41dfa379b6d3050c1e271b0b435b3ee3303',
    rewards: expandTo18Decimals(350_000)
  },
];

function expandTo18Decimals(n: number) {
  return BigNumber.from(n).mul(BigNumber.from(10).pow(18));
}

async function main() {
  const lsdCoin = LsdCoin__factory.connect(lsdCoinAddress, provider);
  const stakingPoolFactory = StakingPoolFactory__factory.connect(stakingPoolFactoryContractAddress, provider);

  const admin = new ethers.Wallet(privateKey, provider);

  let totalRewards = BigNumber.from(0);
  for (let i = 0; i < _.size(pools); i++) {
    totalRewards = totalRewards.add(pools[i].rewards);
  }
  console.log(`Adding total rewards ${ethers.utils.formatUnits(totalRewards, 18)} to ${_.size(pools)} pools`);

  // Approve staking pool factory to spend tokens
  const approveTrans = await lsdCoin.connect(admin).approve(stakingPoolFactory.address, totalRewards);
  await approveTrans.wait();
  console.log(`Approved staking pool factory to spend tokens`);

  for (let i = 0; i < _.size(pools); i++) {
    const pool = pools[i];
    const trans = await stakingPoolFactory.connect(admin).addRewards(pool.stakingTokenAddress, pool.rewards);
    await trans.wait();
    console.log(`Added ${ethers.utils.formatUnits(pool.rewards, 18)} rewards to ${pool.stakingTokenName} staking pool`);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
