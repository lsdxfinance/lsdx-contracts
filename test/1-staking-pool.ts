import _ from 'lodash';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { ONE_DAY_IN_SECS, deployStakingPoolContractsFixture, expandTo18Decimals, expectBigNumberEquals } from './utils';
import { StakingPool__factory } from '../typechain/factories/contracts/StakingPool.sol';

const { provider } = ethers;

describe('Staking Pool', () => {

  it('Basic scenario works', async () => {

    const { flyCoin, stakingPoolFactory, wETH, stETH, frxETH, Alice, Bob, Caro, Dave } = await loadFixture(deployStakingPoolContractsFixture);

    // Deploy a staking pool, starting 1 day later, and lasts for 7 days
    const rewardStartTime = (await time.latest()) + ONE_DAY_IN_SECS;
    const rewardDurationInDays = 7;
    await expect(stakingPoolFactory.connect(Alice).deployPool(wETH.address, rewardStartTime, rewardDurationInDays))
      .to.emit(stakingPoolFactory, 'StakingPoolDeployed').withArgs(anyValue, wETH.address, rewardStartTime, rewardDurationInDays);
    // await expect(stakingPoolFactory.connect(Alice).deployPool(stETH.address, rewardStartTime, rewardDurationInDays))
    //   .to.emit(stakingPoolFactory, 'StakingPoolDeployed').withArgs(anyValue, stETH.address, rewardStartTime, rewardDurationInDays);
    // await expect(stakingPoolFactory.connect(Alice).deployPool(frxETH.address, rewardStartTime, rewardDurationInDays))
    //   .to.emit(stakingPoolFactory, 'StakingPoolDeployed').withArgs(anyValue, frxETH.address, rewardStartTime, rewardDurationInDays);

    // Trying to deposit rewards before start should fail
    const totalReward = expandTo18Decimals(7_000_000);
    await expect(flyCoin.connect(Alice).mint(Alice.address, totalReward)).not.to.be.reverted;
    await expect(stakingPoolFactory.connect(Alice).depositRewards(wETH.address, totalReward)).to.be.rejectedWith(
      /StakingPoolFactory::depositRewards: not ready/,
    );

    // But user should be able to stake now (without rewards)
    await expect(wETH.connect(Alice).mint(Bob.address, expandTo18Decimals(10_000))).not.to.be.reverted;
    await expect(wETH.connect(Alice).mint(Caro.address, expandTo18Decimals(10_000))).not.to.be.reverted;

    const wETHStakingPool = StakingPool__factory.connect(await stakingPoolFactory.getStakingPoolAddress(wETH.address), provider);
    const bobStakeAmount = expandTo18Decimals(9_000);
    await expect(wETH.connect(Bob).approve(wETHStakingPool.address, bobStakeAmount)).not.to.be.reverted;
    await expect(wETHStakingPool.connect(Bob).stake(bobStakeAmount)).not.to.be.reverted;
    expect(await wETHStakingPool.totalSupply()).to.equal(bobStakeAmount);
    expect(await wETHStakingPool.balanceOf(Bob.address)).to.equal(bobStakeAmount);

    // No rewards now
    await time.increase(ONE_DAY_IN_SECS / 2);
    expect(await wETHStakingPool.earned(Bob.address)).to.equal(0);

    // Fast-forward to reward start time
    await time.increaseTo(rewardStartTime);
    // 1_000_000 $FLY per day
    await expect(flyCoin.connect(Alice).approve(stakingPoolFactory.address, totalReward)).not.to.be.reverted;
    await expect(stakingPoolFactory.connect(Alice).depositRewards(wETH.address, totalReward)).not.to.be.reverted;
    
    const caroStakeAmount = expandTo18Decimals(1_000);
    await expect(wETH.connect(Caro).approve(wETHStakingPool.address, caroStakeAmount)).not.to.be.reverted;
    await expect(wETHStakingPool.connect(Caro).stake(caroStakeAmount)).not.to.be.reverted;

    // await expect(wETHStakingPool.connect(Bob).stake(9_000)).not.to.be.reverted;

    // 1_000_000 $FLY per day. Fast-forward 
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 7);
    // await time.increase(ONE_DAY_IN_SECS);
    expectBigNumberEquals(totalReward.mul(9).div(10), await wETHStakingPool.earned(Bob.address));
    expectBigNumberEquals(totalReward.mul(1).div(10), await wETHStakingPool.earned(Caro.address));
  });

});