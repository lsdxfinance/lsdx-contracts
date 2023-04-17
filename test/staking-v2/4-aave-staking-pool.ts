import _ from 'lodash';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { Pool__factory } from '../../typechain/factories/contracts/test/AToken.sol/Pool__factory';
import { AToken__factory } from '../../typechain/factories/contracts/test/AToken.sol/AToken__factory';
import { AaveStakingPool__factory } from '../../typechain/factories/contracts/staking-v2/AaveStakingPool__factory';
import { ONE_DAY_IN_SECS, deployLsdxContractsFixture, expandTo18Decimals, expectBigNumberEquals } from '../utils';

const { provider } = ethers;

describe('V2 AAVE Staking Pool', () => {

  it('Basic scenario works', async () => {

    const { lsdCoin, erc20, Alice, Bob, Caro, Dave } = await loadFixture(deployLsdxContractsFixture);

    const Pool = await ethers.getContractFactory('Pool');
    const PoolContract = await Pool.deploy();
    const pool = Pool__factory.connect(PoolContract.address, provider);

    const AToken = await ethers.getContractFactory('AToken');
    const ATokenContract = await upgrades.deployProxy(AToken, ['AAVE ERC20', 'aERC20']);
    const atoken = AToken__factory.connect(ATokenContract.address, provider);

    await pool.connect(Alice).addAToken(erc20.address, atoken.address);

    const AaveStakingPool = await ethers.getContractFactory('AaveStakingPool');
    const AaveStakingPoolContract = await AaveStakingPool.deploy(pool.address, atoken.address, lsdCoin.address, erc20.address, 7);
    const aaveStakingPool = AaveStakingPool__factory.connect(AaveStakingPoolContract.address, provider);

    const rewardDurationInDays = 7;
    const totalReward = expandTo18Decimals(7_000_000);
    
    await expect(lsdCoin.connect(Alice).mint(Alice.address, totalReward)).not.to.be.reverted;

    // User should be able to stake now (without rewards)
    await expect(erc20.connect(Alice).mint(Bob.address, expandTo18Decimals(10_000))).not.to.be.reverted;
    await expect(erc20.connect(Alice).mint(Caro.address, expandTo18Decimals(10_000))).not.to.be.reverted;

    let bobStakeAmount = expandTo18Decimals(9_000);
    await expect(erc20.connect(Bob).approve(aaveStakingPool.address, bobStakeAmount)).not.to.be.reverted;
    await expect(aaveStakingPool.connect(Bob).stake(bobStakeAmount)).not.to.be.reverted;
    expect(await aaveStakingPool.totalSupply()).to.equal(bobStakeAmount);
    expect(await aaveStakingPool.balanceOf(Bob.address)).to.equal(bobStakeAmount);

    // No rewards now
    expect(await aaveStakingPool.earned(Bob.address)).to.equal(0);

    // Deposit 7_000_000 $LSD as reward (1_000_000 per day)
    const rewardStartTime = await time.latest();
    await expect(lsdCoin.connect(Alice).approve(aaveStakingPool.address, totalReward)).not.to.be.reverted;
    await expect(aaveStakingPool.connect(Alice).addRewards(totalReward))
      .to.emit(aaveStakingPool, 'RewardAdded').withArgs(totalReward);
    // Note: The exact `reward start time` is the block timestamp of `addRewards` transaction,
    // which does not exactly equal to `rewardStartTime`
    expect(await aaveStakingPool.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * rewardDurationInDays);
    
    const caroStakeAmount = expandTo18Decimals(1_000);
    await expect(erc20.connect(Caro).approve(aaveStakingPool.address, caroStakeAmount)).not.to.be.reverted;
    await expect(aaveStakingPool.connect(Caro).stake(caroStakeAmount)).not.to.be.reverted;
    expect(await aaveStakingPool.totalSupply()).to.equal(bobStakeAmount.add(caroStakeAmount));
    expect(await aaveStakingPool.balanceOf(Caro.address)).to.equal(caroStakeAmount);

    // 1_000_000 $LSD per day. Fast-forward to generate rewards
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS);
    // await time.increase(ONE_DAY_IN_SECS);
    const totalRewardPerDay = totalReward.div(rewardDurationInDays);
    expectBigNumberEquals(totalRewardPerDay.mul(9).div(10), await aaveStakingPool.earned(Bob.address));
    expectBigNumberEquals(totalRewardPerDay.mul(1).div(10), await aaveStakingPool.earned(Caro.address));

    // Dave has no rewards
    expect(await aaveStakingPool.balanceOf(Dave.address)).to.equal(0);
    expect(await aaveStakingPool.earned(Dave.address)).to.equal(0);

    // Caro claim $LSD rewards
    await expect(aaveStakingPool.connect(Caro).getReward())
      .to.emit(aaveStakingPool, 'RewardPaid').withArgs(Caro.address, anyValue);
    expect(await aaveStakingPool.earned(Caro.address)).to.equal(0);
    expectBigNumberEquals(await lsdCoin.balanceOf(Caro.address), totalRewardPerDay.mul(1).div(10));

    // Simulate to generate AAVE rewards
    expect(await aaveStakingPool.adminRewards()).to.equal(0);
    const adminRewards = expandTo18Decimals(1_00);
    await expect(atoken.connect(Alice).mint(aaveStakingPool.address, adminRewards)).not.to.be.reverted;
    await expect(erc20.connect(Alice).mint(pool.address, adminRewards)).not.to.be.reverted;
    expect(await aaveStakingPool.adminRewards()).to.equal(adminRewards);

    const prevDaveBalance = await erc20.balanceOf(Dave.address);
    await expect(aaveStakingPool.connect(Bob).withdrawAdminRewards(Bob.address))
      .to.be.rejectedWith(/Ownable: caller is not the owner/);
    await expect(aaveStakingPool.connect(Alice).withdrawAdminRewards(Dave.address))
      .to.emit(aaveStakingPool, 'AdminRewardWithdrawn').withArgs(Dave.address, adminRewards);
    expect(await aaveStakingPool.adminRewards()).to.equal(0);
    const daveBalance = await erc20.balanceOf(Dave.address);
    expect(daveBalance).to.equal(prevDaveBalance.add(adminRewards));

    // Fast-forward 1 day. Bob's reward: 9/10 + 9/10;  Caro's reward: 1/10
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 2);
    expectBigNumberEquals(totalRewardPerDay.mul(18).div(10), await aaveStakingPool.earned(Bob.address));
    expectBigNumberEquals(totalRewardPerDay.mul(1).div(10), await aaveStakingPool.earned(Caro.address));

    // Bob withdraw part of his staking coin
    const bobWithdrawAmount = expandTo18Decimals(5000);
    bobStakeAmount = expandTo18Decimals(9000 - 5000);
    // Now Bob's effective staking is 4000 and Caro's effective staking is 1000
    await expect(aaveStakingPool.connect(Bob).withdraw(expandTo18Decimals(10_000))).to.be.reverted;
    await expect(aaveStakingPool.connect(Bob).withdraw(bobWithdrawAmount))
      .to.emit(aaveStakingPool, 'Withdrawn').withArgs(Bob.address, bobWithdrawAmount);
    expect(await aaveStakingPool.totalSupply()).to.equal(bobStakeAmount.add(caroStakeAmount));
    expect(await aaveStakingPool.balanceOf(Bob.address)).to.equal(bobStakeAmount);
    expect(await aaveStakingPool.balanceOf(Caro.address)).to.equal(caroStakeAmount);
    
    // Fast-forward 1 day. Bob's reward: 9/10 + 9/10 + 8/10;  Caro's reward: 1/10 + 2/10
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 3);
    expectBigNumberEquals(totalRewardPerDay.mul(26).div(10), await aaveStakingPool.earned(Bob.address));
    expectBigNumberEquals(totalRewardPerDay.mul(3).div(10), await aaveStakingPool.earned(Caro.address));

    // 4 days remaining. Now admin could start another round of rewarding.
    // Remaining days are extended to 7;  Reward per day from now on: (7_000_000 * 4 / 7  + 14_000_000) / 7
    const round2TotalReward = expandTo18Decimals(14_000_000);
    const round2TotalRewardPerDay = totalReward.mul(4).div(7).add(round2TotalReward).div(rewardDurationInDays);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, round2TotalReward)).not.to.be.reverted;
    await expect(lsdCoin.connect(Alice).approve(aaveStakingPool.address, round2TotalReward)).not.to.be.reverted;
    await expect(aaveStakingPool.connect(Alice).addRewards(round2TotalReward))
      .to.emit(aaveStakingPool, 'RewardAdded').withArgs(round2TotalReward);
    expect(await aaveStakingPool.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * rewardDurationInDays);

    // Fast-forward 1 day. Now every day, Bob get 8/10 rewards, and Caro get 2/10 rewards
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 4);
    const round1BobReward = totalRewardPerDay.mul(26).div(10);
    const round2CaroReward = totalRewardPerDay.mul(3).div(10);
    expectBigNumberEquals(round1BobReward.add(round2TotalRewardPerDay.mul(8).div(10)), await aaveStakingPool.earned(Bob.address));
    expectBigNumberEquals(round2CaroReward.add(round2TotalRewardPerDay.mul(2).div(10)), await aaveStakingPool.earned(Caro.address));

    // Caro exit staking
    await expect(aaveStakingPool.connect(Caro).exit())
      .to.emit(aaveStakingPool, 'Withdrawn').withArgs(Caro.address, caroStakeAmount)
      .to.emit(aaveStakingPool, 'RewardPaid').withArgs(Caro.address, anyValue);
    expect(await aaveStakingPool.totalSupply()).to.equal(bobStakeAmount);
    expect(await aaveStakingPool.balanceOf(Bob.address)).to.equal(bobStakeAmount);
    expect(await aaveStakingPool.balanceOf(Caro.address)).to.equal(0);
  
    // Now bob get all the staking rewards
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 5);
    expectBigNumberEquals(round1BobReward.add(round2TotalRewardPerDay.mul(18).div(10)), await aaveStakingPool.earned(Bob.address));
    
    // Fast-forward to round 2 finish
    await time.increaseTo(await aaveStakingPool.periodFinish());
    const bobRewardsTillRound2 = round1BobReward.add(round2TotalRewardPerDay.mul(68).div(10));
    expectBigNumberEquals(bobRewardsTillRound2, await aaveStakingPool.earned(Bob.address));

    // Fast-forward 1 more day. No extra rewards are generated
    await time.increaseTo(await (await aaveStakingPool.periodFinish()).add(ONE_DAY_IN_SECS));
    expectBigNumberEquals(bobRewardsTillRound2, await aaveStakingPool.earned(Bob.address));

    // Admin start round 3
    const round3TotalReward = expandTo18Decimals(7_000_000);
    const round3TotalRewardPerDay = round3TotalReward.div(rewardDurationInDays);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, round3TotalReward)).not.to.be.reverted;
    await expect(lsdCoin.connect(Alice).approve(aaveStakingPool.address, round3TotalReward)).not.to.be.reverted;
    await expect(aaveStakingPool.connect(Alice).addRewards(round3TotalReward))
      .to.emit(aaveStakingPool, 'RewardAdded').withArgs(round3TotalReward);
    expect(await aaveStakingPool.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * rewardDurationInDays);

    // Fast-forward 1 more day. Bob gets all the reward
    await time.increase(ONE_DAY_IN_SECS);
    expectBigNumberEquals(bobRewardsTillRound2.add(round3TotalRewardPerDay), await aaveStakingPool.earned(Bob.address));

    // Fast-forward to period finish
    await time.increaseTo(await aaveStakingPool.periodFinish());

    // Bob should be able to exit
    await expect(aaveStakingPool.connect(Bob).exit())
      .to.emit(aaveStakingPool, 'Withdrawn').withArgs(Bob.address, anyValue)
      .to.emit(aaveStakingPool, 'RewardPaid').withArgs(Bob.address, anyValue);
    expect(await aaveStakingPool.totalSupply()).to.equal(0);
    expect(await aaveStakingPool.balanceOf(Bob.address)).to.equal(0);
  });

});