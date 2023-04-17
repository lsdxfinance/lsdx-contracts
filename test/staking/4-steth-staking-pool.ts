import _ from 'lodash';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { ONE_DAY_IN_SECS, deployLsdxContractsFixture, expandTo18Decimals, expectBigNumberEquals } from '../utils';
import { StakingPool__factory } from '../../typechain/factories/contracts/staking/StakingPool__factory';
import { BigNumber } from 'ethers';

const { provider } = ethers;

describe('StETH Staking Pool', () => {

  it('Basic scenario works', async () => {

    const { lsdCoin, stakingPoolFactory, stETH, Alice, Bob, Caro, Dave } = await loadFixture(deployLsdxContractsFixture);

    // Deploy a staking pool, starting 1 day later, and lasts for 7 days
    const rewardStartTime = (await time.latest()) + ONE_DAY_IN_SECS;
    const rewardDurationInDays = 7;
    await expect(stakingPoolFactory.connect(Alice).deployPool(stETH.address, rewardStartTime, rewardDurationInDays))
      .to.emit(stakingPoolFactory, 'StakingPoolDeployed').withArgs(anyValue, stETH.address, rewardStartTime, rewardDurationInDays);
    const stETHStakingPool = StakingPool__factory.connect(await stakingPoolFactory.getStakingPoolAddress(stETH.address), provider);
  
    // Trying to deposit rewards before start should fail
    const totalReward = expandTo18Decimals(7_000_000);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, totalReward)).not.to.be.reverted;
    await expect(stakingPoolFactory.connect(Alice).addRewards(stETH.address, totalReward)).to.be.rejectedWith(
      /StakingPoolFactory::addRewards: not ready/,
    );

    // Trying to withdraw stETH EL rewards should fail
    await expect(stakingPoolFactory.connect(Alice).withdrawELRewards(stETH.address, Alice.address)).to.be.rejectedWith(
      /StakingPoolFactory::withdrawELRewards: not ready/,
    );

    // But user should be able to stake now (without rewards)
    let bobStakeAmount = ethers.utils.parseEther('900');
    await expect(stETH.connect(Bob).submit({value: bobStakeAmount})).not.to.be.reverted;
    await expect(stETH.connect(Bob).approve(stETHStakingPool.address, bobStakeAmount)).not.to.be.reverted;
    await expect(stETHStakingPool.connect(Bob).stake(bobStakeAmount)).not.to.be.reverted;
    expect(await stETHStakingPool.totalSupply()).to.equal(bobStakeAmount);
    expect(await stETHStakingPool.balanceOf(Bob.address)).to.equal(bobStakeAmount);

    // No rewards now
    await time.increase(ONE_DAY_IN_SECS / 2);
    expect(await stETHStakingPool.earned(Bob.address)).to.equal(0);

    // Fast-forward to reward start time, and deposit 7_000_000 $LSD as reward (1_000_000 per day)
    await time.increaseTo(rewardStartTime);
    await expect(lsdCoin.connect(Alice).approve(stakingPoolFactory.address, totalReward)).not.to.be.reverted;
    await expect(stakingPoolFactory.connect(Alice).addRewards(stETH.address, totalReward))
      .to.emit(stETHStakingPool, 'RewardAdded').withArgs(totalReward);
    // Note: The exact `reward start time` is the block timestamp of `addRewards` transaction,
    // which does not exactly equal to `rewardStartTime`
    expect(await stETHStakingPool.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * rewardDurationInDays);
    
    const caroStakeAmount = ethers.utils.parseEther('100');
    await expect(stETH.connect(Caro).submit({value: caroStakeAmount})).not.to.be.reverted;
    await expect(stETH.connect(Caro).approve(stETHStakingPool.address, caroStakeAmount)).not.to.be.reverted;
    await expect(stETHStakingPool.connect(Caro).stake(caroStakeAmount)).not.to.be.reverted;
    expect(await stETHStakingPool.totalSupply()).to.equal(bobStakeAmount.add(caroStakeAmount));
    expect(await stETHStakingPool.balanceOf(Caro.address)).to.equal(caroStakeAmount);

    // Alice deposit EL rewards to stETH pool
    expect(await stETH.balanceOf(stETHStakingPool.address)).to.equal(ethers.utils.parseEther('1000'));
    const stETHELRewards = ethers.utils.parseEther('200');
    await expect(stETH.connect(Alice).receiveELRewards({value: stETHELRewards}))
      .to.changeEtherBalances([Alice.address, stETH.address], [ethers.utils.parseEther('-200'), stETHELRewards]);
    expect(await stETH.balanceOf(stETHStakingPool.address)).to.equal(ethers.utils.parseEther('1200'));

    // Trying to withdraw stETH EL rewards should fail
    await expect(stakingPoolFactory.connect(Alice).withdrawELRewards(stETH.address, Alice.address)).to.be.rejectedWith(
      /Not ready to withdraw EL rewards/,
    );

    // 1_000_000 $LSD per day. Fast-forward to generate rewards
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS);
    // await time.increase(ONE_DAY_IN_SECS);
    const totalRewardPerDay = totalReward.div(rewardDurationInDays);
    expectBigNumberEquals(totalRewardPerDay.mul(9).div(10), await stETHStakingPool.earned(Bob.address));
    expectBigNumberEquals(totalRewardPerDay.mul(1).div(10), await stETHStakingPool.earned(Caro.address));

    // Caro claim $LSD rewards
    await expect(stETHStakingPool.connect(Caro).getReward())
      .to.emit(stETHStakingPool, 'RewardPaid').withArgs(Caro.address, anyValue);
    expect(await stETHStakingPool.earned(Caro.address)).to.equal(0);
    expectBigNumberEquals(await lsdCoin.balanceOf(Caro.address), totalRewardPerDay.mul(1).div(10));

    // Fast-forward 1 day. Bob's reward: 9/10 + 9/10;  Caro's reward: 1/10
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 2);
    expectBigNumberEquals(totalRewardPerDay.mul(18).div(10), await stETHStakingPool.earned(Bob.address));
    expectBigNumberEquals(totalRewardPerDay.mul(1).div(10), await stETHStakingPool.earned(Caro.address));

    // Bob withdraw part of his staking coin
    const bobWithdrawAmount = ethers.utils.parseEther('500');;
    bobStakeAmount = ethers.utils.parseEther('400');
    // Now Bob's effective staking is 400 and Caro's effective staking is 100
    await expect(stETHStakingPool.connect(Bob).withdraw(bobWithdrawAmount))
      .to.emit(stETHStakingPool, 'Withdrawn').withArgs(Bob.address, bobWithdrawAmount);
    expect(await stETHStakingPool.totalSupply()).to.equal(bobStakeAmount.add(caroStakeAmount));
    expect(await stETHStakingPool.balanceOf(Bob.address)).to.equal(bobStakeAmount);
    expect(await stETHStakingPool.balanceOf(Caro.address)).to.equal(caroStakeAmount);
    
    // Fast-forward 1 day. Bob's reward: 9/10 + 9/10 + 8/10;  Caro's reward: 1/10 + 2/10
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 3);
    expectBigNumberEquals(totalRewardPerDay.mul(26).div(10), await stETHStakingPool.earned(Bob.address));
    expectBigNumberEquals(totalRewardPerDay.mul(3).div(10), await stETHStakingPool.earned(Caro.address));

    // 4 days remaining. Now admin could start another round of rewarding.
    // Remaining days are extended to 7;  Reward per day from now on: (7_000_000 * 4 / 7  + 14_000_000) / 7
    const round2TotalReward = expandTo18Decimals(14_000_000);
    const round2TotalRewardPerDay = totalReward.mul(4).div(7).add(round2TotalReward).div(rewardDurationInDays);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, round2TotalReward)).not.to.be.reverted;
    await expect(lsdCoin.connect(Alice).approve(stakingPoolFactory.address, round2TotalReward)).not.to.be.reverted;
    await expect(stakingPoolFactory.connect(Alice).addRewards(stETH.address, round2TotalReward))
      .to.emit(stETHStakingPool, 'RewardAdded').withArgs(round2TotalReward);
    expect(await stETHStakingPool.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * rewardDurationInDays);

    // Fast-forward 1 day. Now every day, Bob get 8/10 rewards, and Caro get 2/10 rewards
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 4);
    const round1BobReward = totalRewardPerDay.mul(26).div(10);
    const round2CaroReward = totalRewardPerDay.mul(3).div(10);
    expectBigNumberEquals(round1BobReward.add(round2TotalRewardPerDay.mul(8).div(10)), await stETHStakingPool.earned(Bob.address));
    expectBigNumberEquals(round2CaroReward.add(round2TotalRewardPerDay.mul(2).div(10)), await stETHStakingPool.earned(Caro.address));

    // Caro exit staking
    await expect(stETHStakingPool.connect(Caro).exit())
      .to.emit(stETHStakingPool, 'Withdrawn').withArgs(Caro.address, caroStakeAmount)
      .to.emit(stETHStakingPool, 'RewardPaid').withArgs(Caro.address, anyValue);
    expect(await stETHStakingPool.totalSupply()).to.equal(bobStakeAmount);
    expect(await stETHStakingPool.balanceOf(Bob.address)).to.equal(bobStakeAmount);
    expect(await stETHStakingPool.balanceOf(Caro.address)).to.equal(0);
  
    // Now bob get all the staking rewards
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 5);
    expectBigNumberEquals(round1BobReward.add(round2TotalRewardPerDay.mul(18).div(10)), await stETHStakingPool.earned(Bob.address));
    
    // Fast-forward to round 2 finish
    await time.increaseTo(await stETHStakingPool.periodFinish());
    const bobRewardsTillRound2 = round1BobReward.add(round2TotalRewardPerDay.mul(68).div(10));
    expectBigNumberEquals(bobRewardsTillRound2, await stETHStakingPool.earned(Bob.address));

    // Fast-forward 1 more day. No extra rewards are generated
    await time.increaseTo(await (await stETHStakingPool.periodFinish()).add(ONE_DAY_IN_SECS));
    expectBigNumberEquals(bobRewardsTillRound2, await stETHStakingPool.earned(Bob.address));

    // Admin start round 3
    const round3TotalReward = expandTo18Decimals(7_000_000);
    const round3TotalRewardPerDay = round3TotalReward.div(rewardDurationInDays);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, round3TotalReward)).not.to.be.reverted;
    await expect(lsdCoin.connect(Alice).approve(stakingPoolFactory.address, round3TotalReward)).not.to.be.reverted;
    await expect(stakingPoolFactory.connect(Alice).addRewards(stETH.address, round3TotalReward))
      .to.emit(stETHStakingPool, 'RewardAdded').withArgs(round3TotalReward);
    expect(await stETHStakingPool.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * rewardDurationInDays);

    // Fast-forward 1 more day. Bob gets all the reward
    await time.increase(ONE_DAY_IN_SECS);
    expectBigNumberEquals(bobRewardsTillRound2.add(round3TotalRewardPerDay), await stETHStakingPool.earned(Bob.address));

    // Fast-forward to period finish
    await time.increaseTo(await stETHStakingPool.periodFinish());

    // Bob exit
    await expect(stETHStakingPool.connect(Bob).exit())
      .to.emit(stETHStakingPool, 'Withdrawn').withArgs(Bob.address, anyValue)
      .to.emit(stETHStakingPool, 'RewardPaid').withArgs(Bob.address, anyValue);
    expect(await stETHStakingPool.totalSupply()).to.equal(0);
    expect(await stETHStakingPool.balanceOf(Bob.address)).to.equal(0);

    // Admin withdraw extra EL rewards
    expectBigNumberEquals(stETHELRewards, await stETH.balanceOf(stETHStakingPool.address));
    await expect(stakingPoolFactory.connect(Bob).withdrawELRewards(stETH.address, Bob.address))
      .to.be.rejectedWith(/Ownable: caller is not the owner/);
    await expect(stETHStakingPool.connect(Bob).withdrawELRewards(Bob.address))
      .to.be.rejectedWith(/Caller is not RewardsDistribution contract/);
    await expect(stakingPoolFactory.connect(Alice).withdrawELRewards(stETH.address, Dave.address))
      .to.emit(stETHStakingPool, 'ELRewardWithdrawn').withArgs(Dave.address, anyValue);
    expectBigNumberEquals(stETHELRewards, await stETH.balanceOf(Dave.address));
  });

});
