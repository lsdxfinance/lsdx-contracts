import _ from 'lodash';
import { expect } from 'chai';
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { ONE_DAY_IN_SECS, deployStakingPoolContractsFixture, expandTo18Decimals, expectBigNumberEquals } from '../utils';

describe('V2 frxETH Staking Pool', () => {

  it('Basic scenario works', async () => {

    const { lsdCoin, v2FraxStakingPool, frxETH, sfrxETH, Alice, Bob, Caro, Dave } = await loadFixture(deployStakingPoolContractsFixture);

    const rewardDurationInDays = 7;

    const totalReward = expandTo18Decimals(7_000_000);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, totalReward)).not.to.be.reverted;

    // User should be able to stake now (without rewards)
    await expect(frxETH.connect(Alice).addMinter(Alice.address))
      .to.emit(frxETH, 'MinterAdded').withArgs(Alice.address);
    await expect(frxETH.connect(Alice).minter_mint(Alice.address, expandTo18Decimals(20_000)))
      .to.emit(frxETH, 'TokenMinterMinted').withArgs(Alice.address, Alice.address, expandTo18Decimals(20_000));
    await expect(frxETH.connect(Alice).minter_mint(Bob.address, expandTo18Decimals(10_000)))
      .to.emit(frxETH, 'TokenMinterMinted').withArgs(Alice.address, Bob.address, expandTo18Decimals(10_000));
    await expect(frxETH.connect(Alice).minter_mint(Caro.address, expandTo18Decimals(10_000)))
      .to.emit(frxETH, 'TokenMinterMinted').withArgs(Alice.address, Caro.address, expandTo18Decimals(10_000));

    let bobStakeAmount = expandTo18Decimals(9_000);
    await expect(frxETH.connect(Bob).approve(v2FraxStakingPool.address, bobStakeAmount)).not.to.be.reverted;
    await expect(v2FraxStakingPool.connect(Bob).stake(bobStakeAmount)).not.to.be.reverted;
    expect(await v2FraxStakingPool.totalSupply()).to.equal(bobStakeAmount);
    expect(await v2FraxStakingPool.balanceOf(Bob.address)).to.equal(bobStakeAmount);

    // No rewards now
    await time.increase(ONE_DAY_IN_SECS / 2);
    expect(await v2FraxStakingPool.earned(Bob.address)).to.equal(0);

    // Deposit 7_000_000 $LSD as reward (1_000_000 per day)
    const rewardStartTime = await time.latest();
    await expect(lsdCoin.connect(Alice).approve(v2FraxStakingPool.address, totalReward)).not.to.be.reverted;
    await expect(v2FraxStakingPool.connect(Alice).addRewards(totalReward))
      .to.emit(v2FraxStakingPool, 'RewardAdded').withArgs(totalReward);
    // Note: The exact `reward start time` is the block timestamp of `addRewards` transaction,
    // which does not exactly equal to `rewardStartTime`
    expect(await v2FraxStakingPool.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * rewardDurationInDays);
    
    const caroStakeAmount = expandTo18Decimals(1_000);
    await expect(frxETH.connect(Caro).approve(v2FraxStakingPool.address, caroStakeAmount)).not.to.be.reverted;
    await expect(v2FraxStakingPool.connect(Caro).stake(caroStakeAmount)).not.to.be.reverted;
    expect(await v2FraxStakingPool.totalSupply()).to.equal(bobStakeAmount.add(caroStakeAmount));
    expect(await v2FraxStakingPool.balanceOf(Caro.address)).to.equal(caroStakeAmount);

    // 1_000_000 $LSD per day. Fast-forward to generate rewards
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS);
    const totalRewardPerDay = totalReward.div(rewardDurationInDays);
    expectBigNumberEquals(totalRewardPerDay.mul(9).div(10), await v2FraxStakingPool.earned(Bob.address));
    expectBigNumberEquals(totalRewardPerDay.mul(1).div(10), await v2FraxStakingPool.earned(Caro.address));

    // Dave has no rewards
    expect(await v2FraxStakingPool.balanceOf(Dave.address)).to.equal(0);
    expect(await v2FraxStakingPool.earned(Dave.address)).to.equal(0);

    // Caro claim $LSD rewards
    await expect(v2FraxStakingPool.connect(Caro).getReward())
      .to.emit(v2FraxStakingPool, 'RewardPaid').withArgs(Caro.address, anyValue);
    expect(await v2FraxStakingPool.earned(Caro.address)).to.equal(0);
    expectBigNumberEquals(await lsdCoin.balanceOf(Caro.address), totalRewardPerDay.mul(1).div(10));

    // Fast-forward 1 day. Bob's reward: 9/10 + 9/10;  Caro's reward: 1/10
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 2);
    expectBigNumberEquals(totalRewardPerDay.mul(18).div(10), await v2FraxStakingPool.earned(Bob.address));
    expectBigNumberEquals(totalRewardPerDay.mul(1).div(10), await v2FraxStakingPool.earned(Caro.address));

    // Admin rewards should be zero if no frxETH is transfered to sfrxETH pool
    expect(await v2FraxStakingPool.adminRewards()).to.equal(0);

    // Bob withdraw part of his staking coin
    const bobWithdrawAmount = expandTo18Decimals(5000);
    bobStakeAmount = expandTo18Decimals(9000 - 5000);
    // Now Bob's effective staking is 4000 and Caro's effective staking is 1000
    await expect(v2FraxStakingPool.connect(Bob).withdraw(expandTo18Decimals(10_000))).to.be.reverted;
    await expect(v2FraxStakingPool.connect(Bob).withdraw(bobWithdrawAmount))
      .to.emit(v2FraxStakingPool, 'Withdrawn').withArgs(Bob.address, bobWithdrawAmount);
    expect(await v2FraxStakingPool.totalSupply()).to.equal(bobStakeAmount.add(caroStakeAmount));
    expect(await v2FraxStakingPool.balanceOf(Bob.address)).to.equal(bobStakeAmount);
    expect(await v2FraxStakingPool.balanceOf(Caro.address)).to.equal(caroStakeAmount);
    
    // Fast-forward 1 day. Bob's reward: 9/10 + 9/10 + 8/10;  Caro's reward: 1/10 + 2/10
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 3);
    expectBigNumberEquals(totalRewardPerDay.mul(26).div(10), await v2FraxStakingPool.earned(Bob.address));
    expectBigNumberEquals(totalRewardPerDay.mul(3).div(10), await v2FraxStakingPool.earned(Caro.address));

    // 4 days remaining. Now admin could start another round of rewarding.
    // Remaining days are extended to 7;  Reward per day from now on: (7_000_000 * 4 / 7  + 14_000_000) / 7
    const round2TotalReward = expandTo18Decimals(14_000_000);
    const round2TotalRewardPerDay = totalReward.mul(4).div(7).add(round2TotalReward).div(rewardDurationInDays);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, round2TotalReward)).not.to.be.reverted;
    await expect(lsdCoin.connect(Alice).approve(v2FraxStakingPool.address, round2TotalReward)).not.to.be.reverted;
    await expect(v2FraxStakingPool.connect(Alice).addRewards(round2TotalReward))
      .to.emit(v2FraxStakingPool, 'RewardAdded').withArgs(round2TotalReward);
    expect(await v2FraxStakingPool.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * rewardDurationInDays);

    // Fast-forward 1 day. Now every day, Bob get 8/10 rewards, and Caro get 2/10 rewards
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 4);
    const round1BobReward = totalRewardPerDay.mul(26).div(10);
    const round2CaroReward = totalRewardPerDay.mul(3).div(10);
    expectBigNumberEquals(round1BobReward.add(round2TotalRewardPerDay.mul(8).div(10)), await v2FraxStakingPool.earned(Bob.address));
    expectBigNumberEquals(round2CaroReward.add(round2TotalRewardPerDay.mul(2).div(10)), await v2FraxStakingPool.earned(Caro.address));

    // Caro exit staking
    await expect(v2FraxStakingPool.connect(Caro).exit())
      .to.emit(v2FraxStakingPool, 'Withdrawn').withArgs(Caro.address, caroStakeAmount)
      .to.emit(v2FraxStakingPool, 'RewardPaid').withArgs(Caro.address, anyValue);
    expect(await v2FraxStakingPool.totalSupply()).to.equal(bobStakeAmount);
    expect(await v2FraxStakingPool.balanceOf(Bob.address)).to.equal(bobStakeAmount);
    expect(await v2FraxStakingPool.balanceOf(Caro.address)).to.equal(0);
  
    // Now bob get all the staking rewards
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 5);
    expectBigNumberEquals(round1BobReward.add(round2TotalRewardPerDay.mul(18).div(10)), await v2FraxStakingPool.earned(Bob.address));
    
    // Fast-forward to round 2 finish
    await time.increaseTo(await v2FraxStakingPool.periodFinish());
    const bobRewardsTillRound2 = round1BobReward.add(round2TotalRewardPerDay.mul(68).div(10));
    expectBigNumberEquals(bobRewardsTillRound2, await v2FraxStakingPool.earned(Bob.address));

    // Fast-forward 1 more day. No extra rewards are generated
    await time.increaseTo(await (await v2FraxStakingPool.periodFinish()).add(ONE_DAY_IN_SECS));
    expectBigNumberEquals(bobRewardsTillRound2, await v2FraxStakingPool.earned(Bob.address));

    // Admin start round 3
    const round3TotalReward = expandTo18Decimals(7_000_000);
    const round3TotalRewardPerDay = round3TotalReward.div(rewardDurationInDays);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, round3TotalReward)).not.to.be.reverted;
    await expect(lsdCoin.connect(Alice).approve(v2FraxStakingPool.address, round3TotalReward)).not.to.be.reverted;
    await expect(v2FraxStakingPool.connect(Alice).addRewards(round3TotalReward))
      .to.emit(v2FraxStakingPool, 'RewardAdded').withArgs(round3TotalReward);
    expect(await v2FraxStakingPool.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * rewardDurationInDays);

    // Fast-forward 1 more day. Bob gets all the reward
    await time.increase(ONE_DAY_IN_SECS);
    expectBigNumberEquals(bobRewardsTillRound2.add(round3TotalRewardPerDay), await v2FraxStakingPool.earned(Bob.address));

    // Alice deposit rewards to sfrxETH pool
    const currentTotalSupply = await v2FraxStakingPool.totalSupply();
    const adminRewards = currentTotalSupply.div(2);
    await expect(frxETH.connect(Alice).transfer(sfrxETH.address, adminRewards)).not.to.be.rejected;

    expect(await v2FraxStakingPool.adminRewards()).to.equal(0);
    await time.increase(604800);
    await expect(sfrxETH.connect(Alice).syncRewards()).not.to.be.reverted;
    await time.increase(604800);
    expect(await v2FraxStakingPool.adminRewards()).to.equal(adminRewards);

    // Admin should be able to withdraw admin staking tokens
    await expect(v2FraxStakingPool.connect(Bob).withdrawAdminRewards(Bob.address))
      .to.be.rejectedWith(/Ownable: caller is not the owner/);
    await expect(v2FraxStakingPool.connect(Alice).withdrawAdminRewards(Dave.address))
      .to.emit(v2FraxStakingPool, 'AdminRewardWithdrawn').withArgs(Dave.address, adminRewards);
    expect(await frxETH.balanceOf(Dave.address)).to.equal(adminRewards);

    // Bob should be able to exit
    await expect(v2FraxStakingPool.connect(Bob).exit())
      .to.emit(v2FraxStakingPool, 'Withdrawn').withArgs(Bob.address, anyValue)
      .to.emit(v2FraxStakingPool, 'RewardPaid').withArgs(Bob.address, anyValue);
    expect(await v2FraxStakingPool.totalSupply()).to.equal(0);
    expect(await v2FraxStakingPool.balanceOf(Bob.address)).to.equal(0);

    expect(await v2FraxStakingPool.adminRewards()).to.equal(0);
  });

});