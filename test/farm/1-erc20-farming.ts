import _ from 'lodash';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { ONE_DAY_IN_SECS, deployLsdxContractsFixture, expandTo18Decimals, expectBigNumberEquals } from '../utils';
import { LsdxFarm__factory } from '../../typechain/factories/contracts/farm/LsdxFarm__factory';

const { provider } = ethers;

const dayjs = require('dayjs');

describe('Staking Pool', () => {

  it('Basic scenario works', async () => {

    const { lsdCoin, lsdxFarmFactory, erc20, Alice, Bob, Caro, Dave } = await loadFixture(deployLsdxContractsFixture);

    // Deploy a farm
    await expect(lsdxFarmFactory.connect(Alice).deployFarm(erc20.address))
      .to.emit(lsdxFarmFactory, 'FarmDeployed').withArgs(anyValue, erc20.address);
    const erc20Farm = LsdxFarm__factory.connect(await lsdxFarmFactory.getFarmAddress(erc20.address), provider);

    // But user should be able to stake now (without rewards)
    await expect(erc20.connect(Alice).mint(Bob.address, expandTo18Decimals(10_000))).not.to.be.reverted;
    await expect(erc20.connect(Alice).mint(Caro.address, expandTo18Decimals(10_000))).not.to.be.reverted;

    let bobStakeAmount = expandTo18Decimals(9_000);
    await expect(erc20.connect(Bob).approve(erc20Farm.address, bobStakeAmount)).not.to.be.reverted;
    await expect(erc20Farm.connect(Bob).stake(bobStakeAmount)).not.to.be.reverted;
    expect(await erc20Farm.totalSupply()).to.equal(bobStakeAmount);
    expect(await erc20Farm.balanceOf(Bob.address)).to.equal(bobStakeAmount);

    // No rewards now
    await time.increase(ONE_DAY_IN_SECS / 2);
    expect(await erc20Farm.earned(Bob.address)).to.equal(0);

    // Dave accidently transfer some staking token to this contract
    const daveTransferAmount = expandTo18Decimals(100);
    await expect(erc20.connect(Alice).mint(Dave.address, daveTransferAmount)).not.to.be.reverted;
    await expect(erc20.connect(Dave).transfer(erc20Farm.address, daveTransferAmount)).not.to.be.reverted;

    // Fast-forward to reward start time, and deposit 7_000_000 $LSD as reward (1_000_000 per day)
    const rewardStartTime = (await time.latest()) + ONE_DAY_IN_SECS;
    const rewardDurationInDays = 7;
    await time.increaseTo(rewardStartTime);
    const totalReward = expandTo18Decimals(7_000_000);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, totalReward)).not.to.be.reverted;
    await expect(lsdCoin.connect(Alice).approve(lsdxFarmFactory.address, totalReward)).not.to.be.reverted;
    await expect(lsdxFarmFactory.connect(Alice).addRewards(erc20.address, totalReward, rewardDurationInDays))
      .to.emit(erc20Farm, 'RewardAdded').withArgs(totalReward, rewardDurationInDays);
    // Note: The exact `reward start time` is the block timestamp of `addRewards` transaction,
    // which does not exactly equal to `rewardStartTime`
    expect(await erc20Farm.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * rewardDurationInDays);
    expect((await lsdxFarmFactory.farmInfoByStakingToken(erc20.address)).totalRewardsAmount).to.equal(totalReward);
    
    const caroStakeAmount = expandTo18Decimals(1_000);
    await expect(erc20.connect(Caro).approve(erc20Farm.address, caroStakeAmount)).not.to.be.reverted;
    await expect(erc20Farm.connect(Caro).stake(caroStakeAmount)).not.to.be.reverted;
    expect(await erc20Farm.totalSupply()).to.equal(bobStakeAmount.add(caroStakeAmount));
    expect(await erc20Farm.balanceOf(Caro.address)).to.equal(caroStakeAmount);

    // 1_000_000 $LSD per day. Fast-forward to generate rewards
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS);
    const totalRewardPerDay = totalReward.div(rewardDurationInDays);
    expectBigNumberEquals(totalRewardPerDay.mul(9).div(10), await erc20Farm.earned(Bob.address));
    expectBigNumberEquals(totalRewardPerDay.mul(1).div(10), await erc20Farm.earned(Caro.address));

    // Dave has no rewards
    expect(await erc20Farm.balanceOf(Dave.address)).to.equal(0);
    expect(await erc20Farm.earned(Dave.address)).to.equal(0);

    // Caro claim $LSD rewards
    await expect(erc20Farm.connect(Caro).getReward())
      .to.emit(erc20Farm, 'RewardPaid').withArgs(Caro.address, anyValue);
    expect(await erc20Farm.earned(Caro.address)).to.equal(0);
    expectBigNumberEquals(await lsdCoin.balanceOf(Caro.address), totalRewardPerDay.mul(1).div(10));

    // Fast-forward 1 day. Bob's reward: 9/10 + 9/10;  Caro's reward: 1/10
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 2);
    expectBigNumberEquals(totalRewardPerDay.mul(18).div(10), await erc20Farm.earned(Bob.address));
    expectBigNumberEquals(totalRewardPerDay.mul(1).div(10), await erc20Farm.earned(Caro.address));

    // Bob withdraw part of his staking coin
    const bobWithdrawAmount = expandTo18Decimals(5000);
    bobStakeAmount = expandTo18Decimals(9000 - 5000);
    // Now Bob's effective staking is 4000 and Caro's effective staking is 1000
    await expect(erc20Farm.connect(Bob).withdraw(expandTo18Decimals(10_000))).to.be.reverted;
    await expect(erc20Farm.connect(Bob).withdraw(bobWithdrawAmount))
      .to.emit(erc20Farm, 'Withdrawn').withArgs(Bob.address, bobWithdrawAmount);
    expect(await erc20Farm.totalSupply()).to.equal(bobStakeAmount.add(caroStakeAmount));
    expect(await erc20Farm.balanceOf(Bob.address)).to.equal(bobStakeAmount);
    expect(await erc20Farm.balanceOf(Caro.address)).to.equal(caroStakeAmount);
    
    // Fast-forward 1 day. Bob's reward: 9/10 + 9/10 + 8/10;  Caro's reward: 1/10 + 2/10
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 3);
    expectBigNumberEquals(totalRewardPerDay.mul(26).div(10), await erc20Farm.earned(Bob.address));
    expectBigNumberEquals(totalRewardPerDay.mul(3).div(10), await erc20Farm.earned(Caro.address));

    // 4 days remaining. Now admin could start another round of rewarding, withd different duration, like 14 days.
    // Remaining days are extended to 14;  Reward per day from now on: (7_000_000 * 4 / 7  + 14_000_000) / 14
    const round2DurationInDays = 14;
    const round2TotalReward = expandTo18Decimals(14_000_000);
    const round2TotalRewardPerDay = totalReward.mul(4).div(7).add(round2TotalReward).div(round2DurationInDays);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, round2TotalReward)).not.to.be.reverted;
    await expect(lsdCoin.connect(Alice).approve(lsdxFarmFactory.address, round2TotalReward)).not.to.be.reverted;
    await expect(lsdxFarmFactory.connect(Alice).addRewards(erc20.address, round2TotalReward, round2DurationInDays))
      .to.emit(erc20Farm, 'RewardAdded').withArgs(round2TotalReward, round2DurationInDays);
    expect(await erc20Farm.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * round2DurationInDays);
    expect((await lsdxFarmFactory.farmInfoByStakingToken(erc20.address)).totalRewardsAmount).to.equal(totalReward.add(round2TotalReward));

    // Fast-forward 1 day. Now every day, Bob get 8/10 rewards, and Caro get 2/10 rewards
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 4);
    const round1BobReward = totalRewardPerDay.mul(26).div(10);
    const round2CaroReward = totalRewardPerDay.mul(3).div(10);
    expectBigNumberEquals(round1BobReward.add(round2TotalRewardPerDay.mul(8).div(10)), await erc20Farm.earned(Bob.address));
    expectBigNumberEquals(round2CaroReward.add(round2TotalRewardPerDay.mul(2).div(10)), await erc20Farm.earned(Caro.address));

    // Caro exit staking
    await expect(erc20Farm.connect(Caro).exit())
      .to.emit(erc20Farm, 'Withdrawn').withArgs(Caro.address, caroStakeAmount)
      .to.emit(erc20Farm, 'RewardPaid').withArgs(Caro.address, anyValue);
    expect(await erc20Farm.totalSupply()).to.equal(bobStakeAmount);
    expect(await erc20Farm.balanceOf(Bob.address)).to.equal(bobStakeAmount);
    expect(await erc20Farm.balanceOf(Caro.address)).to.equal(0);
  
    // Now bob get all the staking rewards
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 5);
    expectBigNumberEquals(round1BobReward.add(round2TotalRewardPerDay.mul(18).div(10)), await erc20Farm.earned(Bob.address));
    
    // Fast-forward to round 2 finish
    await time.increaseTo(await erc20Farm.periodFinish());
    const bobRewardsTillRound2 = round1BobReward.add(round2TotalRewardPerDay.mul(138).div(10));
    expectBigNumberEquals(bobRewardsTillRound2, await erc20Farm.earned(Bob.address));

    // // Fast-forward 1 more day. No extra rewards are generated
    await time.increaseTo(await (await erc20Farm.periodFinish()).add(ONE_DAY_IN_SECS));
    expectBigNumberEquals(bobRewardsTillRound2, await erc20Farm.earned(Bob.address));

    // Admin start round 3 for 3 day only
    const round3DurationInDays = 3;
    const round3TotalReward = expandTo18Decimals(3_000_000);
    const round3TotalRewardPerDay = round3TotalReward.div(round3DurationInDays);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, round3TotalReward)).not.to.be.reverted;
    await expect(lsdCoin.connect(Alice).approve(lsdxFarmFactory.address, round3TotalReward)).not.to.be.reverted;
    await expect(lsdxFarmFactory.connect(Alice).addRewards(erc20.address, round3TotalReward, round3DurationInDays))
      .to.emit(erc20Farm, 'RewardAdded').withArgs(round3TotalReward, round3DurationInDays);
    expect(await erc20Farm.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * round3DurationInDays);
    expect((await lsdxFarmFactory.farmInfoByStakingToken(erc20.address)).totalRewardsAmount).to.equal(totalReward.add(round2TotalReward).add(round3TotalReward));

    // Fast-forward 1 more day. Bob gets all the reward
    await time.increase(ONE_DAY_IN_SECS);
    expectBigNumberEquals(bobRewardsTillRound2.add(round3TotalRewardPerDay), await erc20Farm.earned(Bob.address));

    // Fast-forward to period finish
    await time.increaseTo(await erc20Farm.periodFinish());

    // Bob should be able to exit
    await expect(erc20Farm.connect(Bob).exit())
      .to.emit(erc20Farm, 'Withdrawn').withArgs(Bob.address, anyValue)
      .to.emit(erc20Farm, 'RewardPaid').withArgs(Bob.address, anyValue);
    expect(await erc20Farm.totalSupply()).to.equal(0);
    expect(await erc20Farm.balanceOf(Bob.address)).to.equal(0);
  });

  it('Discontinued staking works', async () => {

    const { lsdCoin, lsdxFarmFactory, erc20, Alice, Bob, Caro } = await loadFixture(deployLsdxContractsFixture);

    // Deploy a staking pool, starting 1 day later, and lasts for 7 days
    const rewardStartTime = (await time.latest()) + ONE_DAY_IN_SECS;
    const rewardDurationInDays = 7;
    await expect(lsdxFarmFactory.connect(Alice).deployFarm(erc20.address))
      .to.emit(lsdxFarmFactory, 'FarmDeployed').withArgs(anyValue, erc20.address);
    const erc20Farm = LsdxFarm__factory.connect(await lsdxFarmFactory.getFarmAddress(erc20.address), provider);
  
    await expect(erc20.connect(Alice).mint(Bob.address, expandTo18Decimals(10_000))).not.to.be.reverted;
    await expect(erc20.connect(Alice).mint(Caro.address, expandTo18Decimals(10_000))).not.to.be.reverted;

    // Fast-forward to reward start time, and deposit 7_000_000 $LSD as reward (1_000_000 per day)
    await time.increaseTo(rewardStartTime);
    const totalReward = expandTo18Decimals(7_000_000);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, totalReward)).not.to.be.reverted;
    await expect(lsdCoin.connect(Alice).approve(lsdxFarmFactory.address, totalReward)).not.to.be.reverted;
    await expect(lsdxFarmFactory.connect(Alice).addRewards(erc20.address, totalReward, rewardDurationInDays))
      .to.emit(erc20Farm, 'RewardAdded').withArgs(totalReward, rewardDurationInDays);
    // Note: The exact `reward start time` is the block timestamp of `addRewards` transaction,
    // which does not exactly equal to `rewardStartTime`
    expect(await erc20Farm.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * rewardDurationInDays);
    expect((await lsdxFarmFactory.farmInfoByStakingToken(erc20.address)).totalRewardsAmount).to.equal(totalReward);
    
    // Fast-forward by one day, with no staking
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS);
    expect(await erc20Farm.totalSupply()).to.equal(0);

    let bobStakeAmount = expandTo18Decimals(1_000);
    await expect(erc20.connect(Bob).approve(erc20Farm.address, bobStakeAmount)).not.to.be.reverted;
    await expect(erc20Farm.connect(Bob).stake(bobStakeAmount)).not.to.be.reverted;
    expect(await erc20Farm.totalSupply()).to.equal(bobStakeAmount);
    expect(await erc20Farm.balanceOf(Bob.address)).to.equal(bobStakeAmount);

    // Fast-forward by one day
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 2);

    // Bob should get 1 day reward
    const totalRewardPerDay = totalReward.div(rewardDurationInDays);
    expectBigNumberEquals(totalRewardPerDay, await erc20Farm.earned(Bob.address));

    // Fast-forward to end
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 8);

    // Bob exit
    await expect(erc20Farm.connect(Bob).exit())
      .to.emit(erc20Farm, 'Withdrawn').withArgs(Bob.address, anyValue)
      .to.emit(erc20Farm, 'RewardPaid').withArgs(Bob.address, anyValue);
    expect(await erc20Farm.totalSupply()).to.equal(0);
    expect(await erc20Farm.balanceOf(Bob.address)).to.equal(0);

    // 1 day rewards remains in the pool
    expectBigNumberEquals(totalRewardPerDay, await lsdCoin.balanceOf(erc20Farm.address));
  });

  it('Staking round could be terminated ahead of schedule', async () => {

    const { lsdCoin, lsdxFarmFactory, erc20, Alice, Bob, Caro } = await loadFixture(deployLsdxContractsFixture);

    await expect(lsdxFarmFactory.connect(Alice).deployFarm(erc20.address))
      .to.emit(lsdxFarmFactory, 'FarmDeployed').withArgs(anyValue, erc20.address);
    const erc20Farm = LsdxFarm__factory.connect(await lsdxFarmFactory.getFarmAddress(erc20.address), provider);
  
    await expect(erc20.connect(Alice).mint(Bob.address, expandTo18Decimals(10_000))).not.to.be.reverted;
    await expect(erc20.connect(Alice).mint(Caro.address, expandTo18Decimals(10_000))).not.to.be.reverted;

    let bobStakeAmount = expandTo18Decimals(1_000);
    await expect(erc20.connect(Bob).approve(erc20Farm.address, bobStakeAmount)).not.to.be.reverted;
    await expect(erc20Farm.connect(Bob).stake(bobStakeAmount)).not.to.be.reverted;
    expect(await erc20Farm.totalSupply()).to.equal(bobStakeAmount);
    expect(await erc20Farm.balanceOf(Bob.address)).to.equal(bobStakeAmount);

    // Deposit 7_000_000 $LSD as reward (1_000_000 per day). Last for 7 days
    const rewardStartTime = (await time.latest()) + ONE_DAY_IN_SECS;
    const rewardDurationInDays = 7;
    await time.increaseTo(rewardStartTime);
    const totalReward = expandTo18Decimals(7_000_000);
    const totalRewardPerDay = totalReward.div(rewardDurationInDays);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, totalReward)).not.to.be.reverted;
    await expect(lsdCoin.connect(Alice).approve(lsdxFarmFactory.address, totalReward)).not.to.be.reverted;
    await expect(lsdxFarmFactory.connect(Alice).addRewards(erc20.address, totalReward, rewardDurationInDays))
      .to.emit(erc20Farm, 'RewardAdded').withArgs(totalReward, rewardDurationInDays);
    // Note: The exact `reward start time` is the block timestamp of `addRewards` transaction,
    // which does not exactly equal to `rewardStartTime`
    expect(await erc20Farm.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * rewardDurationInDays);
    expect((await lsdxFarmFactory.farmInfoByStakingToken(erc20.address)).totalRewardsAmount).to.equal(totalReward);
    
    // Fast-forward by 2 days, Bob get all the rewards
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 2);
    expectBigNumberEquals(totalRewardPerDay.mul(2), await erc20Farm.earned(Bob.address));
    // expect(await erc20Farm.totalSupply()).to.equal(0);

    // 2 days passed, 5 days remaining. Now we start new a new round, but limit the time to 1 day only
    const round2DurationInDays = 1;
    const round2Rewards = expandTo18Decimals(1_000_000);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, round2Rewards)).not.to.be.reverted;
    await expect(lsdCoin.connect(Alice).approve(lsdxFarmFactory.address, round2Rewards)).not.to.be.reverted;
    await expect(lsdxFarmFactory.connect(Alice).addRewards(erc20.address, round2Rewards, round2DurationInDays))
      .to.emit(erc20Farm, 'RewardAdded').withArgs(round2Rewards, round2DurationInDays);

    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 3);
    const round2RewardPerDay = totalRewardPerDay.mul(5).add(round2Rewards.div(round2DurationInDays));
    expectBigNumberEquals(totalRewardPerDay.mul(2).add(round2RewardPerDay), await erc20Farm.earned(Bob.address));

    // Reward finish. Fast forward, no more rewards
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 4);
    expectBigNumberEquals(totalRewardPerDay.mul(2).add(round2RewardPerDay), await erc20Farm.earned(Bob.address));

    // Bob exit
    await expect(erc20Farm.connect(Bob).exit())
      .to.emit(erc20Farm, 'Withdrawn').withArgs(Bob.address, anyValue)
      .to.emit(erc20Farm, 'RewardPaid').withArgs(Bob.address, anyValue);
    expect(await erc20Farm.totalSupply()).to.equal(0);
    expect(await erc20Farm.balanceOf(Bob.address)).to.equal(0);
  });

  it('Deploying Farm fails if called twice for same token', async () => {

    const { lsdxFarmFactory, erc20, Alice } = await loadFixture(deployLsdxContractsFixture);

    await expect(lsdxFarmFactory.connect(Alice).deployFarm(erc20.address))
      .to.emit(lsdxFarmFactory, 'FarmDeployed').withArgs(anyValue, erc20.address);

    await expect(lsdxFarmFactory.connect(Alice).deployFarm(erc20.address))
      .to.be.rejectedWith(
        /LsdxFarmFactory::deployFarm: already deployed/,
      );

  });

  it('Deploying Farm can only be called by the owner', async () => {

    const { lsdxFarmFactory, erc20, Bob } = await loadFixture(deployLsdxContractsFixture);

    await expect(lsdxFarmFactory.connect(Bob).deployFarm(erc20.address))
      .to.be.rejectedWith(
        /Ownable: caller is not the owner/,
      );

  });

  it('Deployed Farm information is correctly stored', async () => {

    const { lsdxFarmFactory, erc20, weth, Alice } = await loadFixture(deployLsdxContractsFixture);

    const pools = [
      {
        stakingTokenName: 'WETH',
        stakingTokenAddress: weth.address
      },
      {
        stakingTokenName: 'stETH',
        stakingTokenAddress: erc20.address
      }
    ];

    for (let i = 0; i < _.size(pools); i++) {
      const pool = pools[i];
      await expect(lsdxFarmFactory.connect(Alice).deployFarm(pool.stakingTokenAddress))
        .to.emit(lsdxFarmFactory, 'FarmDeployed').withArgs(anyValue, pool.stakingTokenAddress);
    }

    expect(await lsdxFarmFactory.getStakingTokens()).to.deep.equal([weth.address, erc20.address]);

    const ethStakingPoolInfo = await lsdxFarmFactory.farmInfoByStakingToken(weth.address);
    expect(ethStakingPoolInfo.farmAddress).to.equal(await lsdxFarmFactory.getFarmAddress(weth.address));
    expect(ethStakingPoolInfo.totalRewardsAmount).to.equal(0);

    const erc20StakingPoolInfo = await lsdxFarmFactory.farmInfoByStakingToken(erc20.address);
    expect(erc20StakingPoolInfo.farmAddress).to.equal(await lsdxFarmFactory.getFarmAddress(erc20.address));
    expect(erc20StakingPoolInfo.totalRewardsAmount).to.equal(0);
  });

  it('Ownership and rewardership can be managed', async () => {
    const { lsdCoin, lsdxFarmFactory, erc20, Alice, Bob, Caro, Dave } = await loadFixture(deployLsdxContractsFixture);

    // Bob should fail to deploy a pool
    const rewardStartTime = (await time.latest()) + ONE_DAY_IN_SECS;
    const rewardDurationInDays = 7;
    await expect(lsdxFarmFactory.connect(Bob).deployFarm(erc20.address))
      .to.be.rejectedWith(/Ownable: caller is not the owner/);

    // Alice transfer ownership to Bob
    await expect(lsdxFarmFactory.connect(Alice).transferOwnership(Bob.address))
      .to.emit(lsdxFarmFactory, 'OwnershipTransferred').withArgs(Alice.address, Bob.address);

    // Alice lose ownership
    await expect(lsdxFarmFactory.connect(Alice).deployFarm(erc20.address))
      .to.be.rejectedWith(/Ownable: caller is not the owner/);

    // Bob should be able to call admin functions
    await expect(lsdxFarmFactory.connect(Bob).deployFarm(erc20.address))
      .to.emit(lsdxFarmFactory, 'FarmDeployed').withArgs(anyValue, erc20.address);
    const erc20Farm = LsdxFarm__factory.connect(await lsdxFarmFactory.getFarmAddress(erc20.address), provider);

    const totalReward = expandTo18Decimals(1_000_000);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, totalReward)).not.to.be.reverted;
    await expect(lsdCoin.connect(Alice).mint(Bob.address, totalReward)).not.to.be.reverted;

    await time.increaseTo(rewardStartTime);
    await expect(lsdCoin.connect(Alice).approve(lsdxFarmFactory.address, totalReward)).not.to.be.reverted;
    await expect(lsdCoin.connect(Bob).approve(lsdxFarmFactory.address, totalReward)).not.to.be.reverted;

    // Alice is still a rewarder, could add rewards
    await expect(lsdxFarmFactory.connect(Alice).addRewards(erc20.address, totalReward, rewardDurationInDays)).not.to.be.rejected;

    // Bos is now the owner, but is not a rewarder
    await expect(lsdxFarmFactory.connect(Bob).addRewards(erc20.address, totalReward, rewardDurationInDays))
      .to.be.rejectedWith(/Not a rewarder/);
    
    await expect(lsdxFarmFactory.connect(Bob).addRewarder(Bob.address))
      .to.emit(lsdxFarmFactory, 'RewarderAdded').withArgs(Bob.address);

    await expect(lsdxFarmFactory.connect(Bob).addRewards(erc20.address, expandTo18Decimals(500_000), rewardDurationInDays))
      .to.emit(erc20Farm, 'RewardAdded').withArgs(expandTo18Decimals(500_000), rewardDurationInDays);

    await expect(lsdxFarmFactory.connect(Bob).removeRewarder(Bob.address))
      .to.emit(lsdxFarmFactory, 'RewarderRemoved').withArgs(Bob.address);

    await expect(lsdxFarmFactory.connect(Bob).addRewards(erc20.address, expandTo18Decimals(500_000), rewardDurationInDays))
      .to.be.rejectedWith(/Not a rewarder/);
  });

});