import _ from 'lodash';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { ONE_DAY_IN_SECS, nativeTokenAddress, deployStakingPoolContractsFixture, expandTo18Decimals, expectBigNumberEquals } from './utils';
import { StakingPool__factory } from '../typechain/factories/contracts/StakingPool__factory';

const { provider } = ethers;

describe('Eth Staking Pool', () => {

  it('Basic scenario works', async () => {

    const { flyCoin, stakingPoolFactory, weth, Alice, Bob, Caro } = await loadFixture(deployStakingPoolContractsFixture);

    // Deploy a staking pool, starting 1 day later, and lasts for 7 days
    const rewardStartTime = (await time.latest()) + ONE_DAY_IN_SECS;
    const rewardDurationInDays = 7;
    await expect(stakingPoolFactory.connect(Alice).deployPool(nativeTokenAddress, rewardStartTime, rewardDurationInDays))
      .to.emit(stakingPoolFactory, 'StakingPoolDeployed').withArgs(anyValue, nativeTokenAddress, rewardStartTime, rewardDurationInDays);
    const ethStakingPool = StakingPool__factory.connect(await stakingPoolFactory.getStakingPoolAddress(nativeTokenAddress), provider);
  
    // Trying to deposit rewards before start should fail
    const totalReward = expandTo18Decimals(7_000_000);
    await expect(flyCoin.connect(Alice).mint(Alice.address, totalReward)).not.to.be.reverted;
    await expect(stakingPoolFactory.connect(Alice).addRewards(nativeTokenAddress, totalReward)).to.be.rejectedWith(
      /StakingPoolFactory::addRewards: not ready/,
    );

    // console.log(ethers.utils.formatEther(await provider.getBalance(Alice.address)));

    // But user should be able to stake now (without rewards)
    let bobStakeAmount = ethers.utils.parseEther('9000');
    let negtiveBobStakeAmount = ethers.utils.parseEther('-9000');
    await expect(ethStakingPool.connect(Bob).stake(bobStakeAmount, {value: bobStakeAmount}))
      .to.emit(weth, 'Deposit').withArgs(bobStakeAmount)
      .to.emit(ethStakingPool, 'Staked').withArgs(bobStakeAmount)
      .to.changeEtherBalances([Bob.address, weth.address], [negtiveBobStakeAmount, bobStakeAmount]);
    expect(await weth.balanceOf(ethStakingPool.address)).to.equal(bobStakeAmount);
    expect(await ethStakingPool.totalSupply()).to.equal(bobStakeAmount);
    expect(await ethStakingPool.balanceOf(Bob.address)).to.equal(bobStakeAmount);

    // No rewards now
    await time.increase(ONE_DAY_IN_SECS / 2);
    expect(await ethStakingPool.earned(Bob.address)).to.equal(0);

    // Fast-forward to reward start time, and deposit 7_000_000 $FLY as reward (1_000_000 per day)
    await time.increaseTo(rewardStartTime);
    await expect(flyCoin.connect(Alice).approve(stakingPoolFactory.address, totalReward)).not.to.be.reverted;
    await expect(stakingPoolFactory.connect(Alice).addRewards(nativeTokenAddress, totalReward))
      .to.emit(ethStakingPool, 'RewardAdded').withArgs(totalReward);
    // Note: The exact `reward start time` is the block timestamp of `addRewards` transaction,
    // which does not exactly equal to `rewardStartTime`
    expect(await ethStakingPool.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * rewardDurationInDays);
    
    const caroStakeAmount = ethers.utils.parseEther('1000');
    const negativeCaroStakeAmount = ethers.utils.parseEther('-1000');
    await expect(ethStakingPool.connect(Caro).stake(caroStakeAmount, {value: caroStakeAmount}))
      .to.emit(weth, 'Deposit').withArgs(caroStakeAmount)
      .to.emit(ethStakingPool, 'Staked').withArgs(caroStakeAmount)
      .to.changeEtherBalances([Caro.address, weth.address], [negativeCaroStakeAmount, caroStakeAmount]);
    expect(await weth.balanceOf(ethStakingPool.address)).to.equal(bobStakeAmount.add(caroStakeAmount));
    expect(await ethStakingPool.totalSupply()).to.equal(bobStakeAmount.add(caroStakeAmount));
    expect(await ethStakingPool.balanceOf(Caro.address)).to.equal(caroStakeAmount);

    // 1_000_000 $FLY per day. Fast-forward to generate rewards
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS);
    // await time.increase(ONE_DAY_IN_SECS);
    const totalRewardPerDay = totalReward.div(rewardDurationInDays);
    expectBigNumberEquals(totalRewardPerDay.mul(9).div(10), await ethStakingPool.earned(Bob.address));
    expectBigNumberEquals(totalRewardPerDay.mul(1).div(10), await ethStakingPool.earned(Caro.address));

    // Caro claim $FLY rewards
    await expect(ethStakingPool.connect(Caro).getReward())
      .to.emit(ethStakingPool, 'RewardPaid').withArgs(Caro.address, anyValue);
    expect(await ethStakingPool.earned(Caro.address)).to.equal(0);
    expectBigNumberEquals(await flyCoin.balanceOf(Caro.address), totalRewardPerDay.mul(1).div(10));

    // Fast-forward 1 day. Bob's reward: 9/10 + 9/10;  Caro's reward: 1/10
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 2);
    expectBigNumberEquals(totalRewardPerDay.mul(18).div(10), await ethStakingPool.earned(Bob.address));
    expectBigNumberEquals(totalRewardPerDay.mul(1).div(10), await ethStakingPool.earned(Caro.address));

    // // Bob withdraw part of his staking coin
    const bobWithdrawAmount = ethers.utils.parseEther('5000');
    bobStakeAmount = ethers.utils.parseEther('4000');
    // Now Bob's effective staking is 4000 and Caro's effective staking is 1000
    await expect(ethStakingPool.connect(Bob).withdraw(bobWithdrawAmount))
      .to.emit(weth, 'Withdrawal').withArgs(bobWithdrawAmount)
      .to.emit(ethStakingPool, 'Withdrawn').withArgs(Bob.address, bobWithdrawAmount)
      .to.changeEtherBalances([Bob.address, weth.address], [bobWithdrawAmount, ethers.utils.parseEther('-5000')]);
    expect(await weth.balanceOf(ethStakingPool.address)).to.equal(bobStakeAmount.add(caroStakeAmount));
    expect(await ethStakingPool.totalSupply()).to.equal(bobStakeAmount.add(caroStakeAmount));
    expect(await ethStakingPool.balanceOf(Bob.address)).to.equal(bobStakeAmount);
    expect(await ethStakingPool.balanceOf(Caro.address)).to.equal(caroStakeAmount);
    
    // Fast-forward 1 day. Bob's reward: 9/10 + 9/10 + 8/10;  Caro's reward: 1/10 + 2/10
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 3);
    expectBigNumberEquals(totalRewardPerDay.mul(26).div(10), await ethStakingPool.earned(Bob.address));
    expectBigNumberEquals(totalRewardPerDay.mul(3).div(10), await ethStakingPool.earned(Caro.address));

    // 4 days remaining. Now admin could start another round of rewarding.
    // Remaining days are extended to 7;  Reward per day from now on: (7_000_000 * 4 / 7  + 14_000_000) / 7
    const round2TotalReward = expandTo18Decimals(14_000_000);
    const round2TotalRewardPerDay = totalReward.mul(4).div(7).add(round2TotalReward).div(rewardDurationInDays);
    await expect(flyCoin.connect(Alice).mint(Alice.address, round2TotalReward)).not.to.be.reverted;
    await expect(flyCoin.connect(Alice).approve(stakingPoolFactory.address, round2TotalReward)).not.to.be.reverted;
    await expect(stakingPoolFactory.connect(Alice).addRewards(nativeTokenAddress, round2TotalReward))
      .to.emit(ethStakingPool, 'RewardAdded').withArgs(round2TotalReward);
    expect(await ethStakingPool.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * rewardDurationInDays);

    // Fast-forward 1 day. Now every day, Bob get 8/10 rewards, and Caro get 2/10 rewards
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 4);
    const round1BobReward = totalRewardPerDay.mul(26).div(10);
    const round2CaroReward = totalRewardPerDay.mul(3).div(10);
    expectBigNumberEquals(round1BobReward.add(round2TotalRewardPerDay.mul(8).div(10)), await ethStakingPool.earned(Bob.address));
    expectBigNumberEquals(round2CaroReward.add(round2TotalRewardPerDay.mul(2).div(10)), await ethStakingPool.earned(Caro.address));

    // Caro exit staking
    await expect(ethStakingPool.connect(Caro).exit())
      .to.emit(weth, 'Withdrawal').withArgs(caroStakeAmount)
      .to.emit(ethStakingPool, 'Withdrawn').withArgs(Caro.address, caroStakeAmount)
      .to.emit(ethStakingPool, 'RewardPaid').withArgs(Caro.address, anyValue)
      .to.changeEtherBalances([Caro.address, weth.address], [caroStakeAmount, negativeCaroStakeAmount]);
    expect(await weth.balanceOf(ethStakingPool.address)).to.equal(bobStakeAmount);
    expect(await ethStakingPool.totalSupply()).to.equal(bobStakeAmount);
    expect(await ethStakingPool.balanceOf(Bob.address)).to.equal(bobStakeAmount);
    expect(await ethStakingPool.balanceOf(Caro.address)).to.equal(0);
  
    // Now bob get all the staking rewards
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 5);
    expectBigNumberEquals(round1BobReward.add(round2TotalRewardPerDay.mul(18).div(10)), await ethStakingPool.earned(Bob.address));
    
    // Fast-forward to round 2 finish
    await time.increaseTo(await ethStakingPool.periodFinish());
    const bobRewardsSinceRound2 = round1BobReward.add(round2TotalRewardPerDay.mul(68).div(10));
    expectBigNumberEquals(bobRewardsSinceRound2, await ethStakingPool.earned(Bob.address));

    // Fast-forward 1 more day. No extra rewards are generated
    await time.increaseTo(await (await ethStakingPool.periodFinish()).add(ONE_DAY_IN_SECS));
    expectBigNumberEquals(bobRewardsSinceRound2, await ethStakingPool.earned(Bob.address));

    // Admin start round 3
    const round3TotalReward = expandTo18Decimals(7_000_000);
    const round3TotalRewardPerDay = round3TotalReward.div(rewardDurationInDays);
    await expect(flyCoin.connect(Alice).mint(Alice.address, round3TotalReward)).not.to.be.reverted;
    await expect(flyCoin.connect(Alice).approve(stakingPoolFactory.address, round3TotalReward)).not.to.be.reverted;
    await expect(stakingPoolFactory.connect(Alice).addRewards(nativeTokenAddress, round3TotalReward))
      .to.emit(ethStakingPool, 'RewardAdded').withArgs(round3TotalReward);
    expect(await ethStakingPool.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * rewardDurationInDays);

    // Fast-forward 1 more day. Bob gets all the reward
    await time.increase(ONE_DAY_IN_SECS);
    expectBigNumberEquals(bobRewardsSinceRound2.add(round3TotalRewardPerDay), await ethStakingPool.earned(Bob.address));

  });

});