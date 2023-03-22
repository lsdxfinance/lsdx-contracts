import _ from 'lodash';
import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { Pool__factory } from '../typechain/factories/contracts/test/AToken.sol/Pool__factory';
import { AToken__factory } from '../typechain/factories/contracts/test/AToken.sol/AToken__factory';
import { AaveEthStakingPool__factory } from '../typechain/factories/contracts/v2/AaveEthStakingPool__factory';
import { ONE_DAY_IN_SECS, nativeTokenAddress, deployStakingPoolContractsFixture, expandTo18Decimals, expectBigNumberEquals } from './utils';
import { StakingPool__factory } from '../typechain/factories/contracts/StakingPool__factory';

const { provider } = ethers;

describe('AAVE ETH Staking Pool', () => {

  it('Basic scenario works', async () => {

    const { lsdCoin, weth, Alice, Bob, Caro, Dave } = await loadFixture(deployStakingPoolContractsFixture);

    const Pool = await ethers.getContractFactory('Pool');
    const PoolContract = await Pool.deploy();
    const pool = Pool__factory.connect(PoolContract.address, provider);

    const AToken = await ethers.getContractFactory('AToken');
    const ATokenContract = await upgrades.deployProxy(AToken, ['AAVE ERC20', 'aERC20']);
    const atoken = AToken__factory.connect(ATokenContract.address, provider);

    await pool.connect(Alice).addAToken(weth.address, atoken.address);

    const AaveEthStakingPool = await ethers.getContractFactory('AaveEthStakingPool');
    const AaveEthStakingPoolContract = await AaveEthStakingPool.deploy(pool.address, atoken.address, lsdCoin.address, weth.address, 7);
    const aaveEthStakingPool = AaveEthStakingPool__factory.connect(AaveEthStakingPoolContract.address, provider);

    const rewardDurationInDays = 7;

    const totalReward = expandTo18Decimals(7_000_000);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, totalReward)).not.to.be.reverted;

    // User should be able to stake now (without rewards)
    let bobStakeAmount = ethers.utils.parseEther('9000');
    let negtiveBobStakeAmount = ethers.utils.parseEther('-9000');
    // Insufficient `value` should fail
    await expect(aaveEthStakingPool.connect(Bob).stake(bobStakeAmount, {value: ethers.utils.parseEther('8000')}))
      .to.be.rejectedWith(/Not enough value/);
    await expect(aaveEthStakingPool.connect(Bob).stake(bobStakeAmount, {value: bobStakeAmount}))
      .to.emit(weth, 'Deposit').withArgs(bobStakeAmount)
      .to.emit(aaveEthStakingPool, 'Staked').withArgs(bobStakeAmount)
      .to.changeEtherBalances([Bob.address, weth.address], [negtiveBobStakeAmount, bobStakeAmount]);
    expect(await weth.balanceOf(pool.address)).to.equal(bobStakeAmount);
    expect(await aaveEthStakingPool.totalSupply()).to.equal(bobStakeAmount);
    expect(await aaveEthStakingPool.balanceOf(Bob.address)).to.equal(bobStakeAmount);

    // No rewards now
    await time.increase(ONE_DAY_IN_SECS / 2);
    expect(await aaveEthStakingPool.earned(Bob.address)).to.equal(0);

    // Deposit 7_000_000 $LSD as reward (1_000_000 per day)
    const rewardStartTime = await time.latest();
    await expect(lsdCoin.connect(Alice).approve(aaveEthStakingPool.address, totalReward)).not.to.be.reverted;
    await expect(aaveEthStakingPool.connect(Alice).addRewards(totalReward))
      .to.emit(aaveEthStakingPool, 'RewardAdded').withArgs(totalReward);
    // Note: The exact `reward start time` is the block timestamp of `addRewards` transaction,
    // which does not exactly equal to `rewardStartTime`
    expect(await aaveEthStakingPool.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * rewardDurationInDays);
    
    const caroStakeAmount = ethers.utils.parseEther('1000');
    const negativeCaroStakeAmount = ethers.utils.parseEther('-1000');
    // Extra ether should be auto re-funded
    await expect(aaveEthStakingPool.connect(Caro).stake(caroStakeAmount, {value: ethers.utils.parseEther('1100')}))
      .to.emit(weth, 'Deposit').withArgs(caroStakeAmount)
      .to.emit(aaveEthStakingPool, 'Staked').withArgs(caroStakeAmount)
      .to.changeEtherBalances([Caro.address, weth.address], [negativeCaroStakeAmount, caroStakeAmount]);
    expect(await weth.balanceOf(pool.address)).to.equal(bobStakeAmount.add(caroStakeAmount));
    expect(await aaveEthStakingPool.totalSupply()).to.equal(bobStakeAmount.add(caroStakeAmount));
    expect(await aaveEthStakingPool.balanceOf(Caro.address)).to.equal(caroStakeAmount);

    // 1_000_000 $LSD per day. Fast-forward to generate rewards
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS);
    // await time.increase(ONE_DAY_IN_SECS);
    const totalRewardPerDay = totalReward.div(rewardDurationInDays);
    expectBigNumberEquals(totalRewardPerDay.mul(9).div(10), await aaveEthStakingPool.earned(Bob.address));
    expectBigNumberEquals(totalRewardPerDay.mul(1).div(10), await aaveEthStakingPool.earned(Caro.address));

     // Dave has no rewards
    expect(await aaveEthStakingPool.balanceOf(Dave.address)).to.equal(0);
    expect(await aaveEthStakingPool.earned(Dave.address)).to.equal(0);

    // Caro claim $LSD rewards
    await expect(aaveEthStakingPool.connect(Caro).getReward())
      .to.emit(aaveEthStakingPool, 'RewardPaid').withArgs(Caro.address, anyValue);
    expect(await aaveEthStakingPool.earned(Caro.address)).to.equal(0);
    expectBigNumberEquals(await lsdCoin.balanceOf(Caro.address), totalRewardPerDay.mul(1).div(10));

    // Fast-forward 1 day. Bob's reward: 9/10 + 9/10;  Caro's reward: 1/10
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 2);
    expectBigNumberEquals(totalRewardPerDay.mul(18).div(10), await aaveEthStakingPool.earned(Bob.address));
    expectBigNumberEquals(totalRewardPerDay.mul(1).div(10), await aaveEthStakingPool.earned(Caro.address));

    // // Bob withdraw part of his staking coin
    const bobWithdrawAmount = ethers.utils.parseEther('5000');
    bobStakeAmount = ethers.utils.parseEther('4000');
    // Now Bob's effective staking is 4000 and Caro's effective staking is 1000
    await expect(aaveEthStakingPool.connect(Bob).withdraw(ethers.utils.parseEther('10000'))).to.be.reverted;
    await expect(aaveEthStakingPool.connect(Bob).withdraw(bobWithdrawAmount))
      .to.emit(weth, 'Withdrawal').withArgs(bobWithdrawAmount)
      .to.emit(aaveEthStakingPool, 'Withdrawn').withArgs(Bob.address, bobWithdrawAmount)
      .to.changeEtherBalances([Bob.address, weth.address], [bobWithdrawAmount, ethers.utils.parseEther('-5000')]);
    expect(await weth.balanceOf(pool.address)).to.equal(bobStakeAmount.add(caroStakeAmount));
    expect(await aaveEthStakingPool.totalSupply()).to.equal(bobStakeAmount.add(caroStakeAmount));
    expect(await aaveEthStakingPool.balanceOf(Bob.address)).to.equal(bobStakeAmount);
    expect(await aaveEthStakingPool.balanceOf(Caro.address)).to.equal(caroStakeAmount);
    
    // Fast-forward 1 day. Bob's reward: 9/10 + 9/10 + 8/10;  Caro's reward: 1/10 + 2/10
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 3);
    expectBigNumberEquals(totalRewardPerDay.mul(26).div(10), await aaveEthStakingPool.earned(Bob.address));
    expectBigNumberEquals(totalRewardPerDay.mul(3).div(10), await aaveEthStakingPool.earned(Caro.address));

    // 4 days remaining. Now admin could start another round of rewarding.
    // Remaining days are extended to 7;  Reward per day from now on: (7_000_000 * 4 / 7  + 14_000_000) / 7
    const round2TotalReward = expandTo18Decimals(14_000_000);
    const round2TotalRewardPerDay = totalReward.mul(4).div(7).add(round2TotalReward).div(rewardDurationInDays);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, round2TotalReward)).not.to.be.reverted;
    await expect(lsdCoin.connect(Alice).approve(aaveEthStakingPool.address, round2TotalReward)).not.to.be.reverted;
    await expect(aaveEthStakingPool.connect(Alice).addRewards(round2TotalReward))
      .to.emit(aaveEthStakingPool, 'RewardAdded').withArgs(round2TotalReward);
    expect(await aaveEthStakingPool.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * rewardDurationInDays);

    // Simulate to generate AAVE rewards
    expect(await aaveEthStakingPool.adminRewards()).to.equal(0);
    const adminRewards = expandTo18Decimals(1_00);
    await expect(atoken.connect(Alice).mint(aaveEthStakingPool.address, adminRewards)).not.to.be.reverted;
    await expect(weth.connect(Alice).deposit({value: adminRewards})).not.to.be.reverted;
    await expect(weth.connect(Alice).transfer(pool.address, adminRewards)).not.to.be.reverted;
    expect(await aaveEthStakingPool.adminRewards()).to.equal(adminRewards);

    await expect(aaveEthStakingPool.connect(Bob).withdrawAdminRewards(Bob.address))
    .to.be.rejectedWith(/Ownable: caller is not the owner/);
    await expect(aaveEthStakingPool.connect(Alice).withdrawAdminRewards(Dave.address))
      .to.emit(aaveEthStakingPool, 'AdminRewardWithdrawn').withArgs(Dave.address, adminRewards);
    expect(await aaveEthStakingPool.adminRewards()).to.equal(0);
    await expect(pool.connect(Dave).withdraw(weth.address, adminRewards, Dave.address)).not.to.be.reverted;

    // Fast-forward 1 day. Now every day, Bob get 8/10 rewards, and Caro get 2/10 rewards
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 4);
    const round1BobReward = totalRewardPerDay.mul(26).div(10);
    const round2CaroReward = totalRewardPerDay.mul(3).div(10);
    expectBigNumberEquals(round1BobReward.add(round2TotalRewardPerDay.mul(8).div(10)), await aaveEthStakingPool.earned(Bob.address));
    expectBigNumberEquals(round2CaroReward.add(round2TotalRewardPerDay.mul(2).div(10)), await aaveEthStakingPool.earned(Caro.address));

    // Caro exit staking
    await expect(aaveEthStakingPool.connect(Caro).exit())
      .to.emit(weth, 'Withdrawal').withArgs(caroStakeAmount)
      .to.emit(aaveEthStakingPool, 'Withdrawn').withArgs(Caro.address, caroStakeAmount)
      .to.emit(aaveEthStakingPool, 'RewardPaid').withArgs(Caro.address, anyValue)
      .to.changeEtherBalances([Caro.address, weth.address], [caroStakeAmount, negativeCaroStakeAmount]);
    expect(await weth.balanceOf(pool.address)).to.equal(bobStakeAmount);
    expect(await aaveEthStakingPool.totalSupply()).to.equal(bobStakeAmount);
    expect(await aaveEthStakingPool.balanceOf(Bob.address)).to.equal(bobStakeAmount);
    expect(await aaveEthStakingPool.balanceOf(Caro.address)).to.equal(0);
  
    // Now bob get all the staking rewards
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 5);
    expectBigNumberEquals(round1BobReward.add(round2TotalRewardPerDay.mul(18).div(10)), await aaveEthStakingPool.earned(Bob.address));
    
    // Fast-forward to round 2 finish
    await time.increaseTo(await aaveEthStakingPool.periodFinish());
    const bobRewardsTillRound2 = round1BobReward.add(round2TotalRewardPerDay.mul(68).div(10));
    expectBigNumberEquals(bobRewardsTillRound2, await aaveEthStakingPool.earned(Bob.address));

    // Fast-forward 1 more day. No extra rewards are generated
    await time.increaseTo(await (await aaveEthStakingPool.periodFinish()).add(ONE_DAY_IN_SECS));
    expectBigNumberEquals(bobRewardsTillRound2, await aaveEthStakingPool.earned(Bob.address));

    // Admin start round 3
    const round3TotalReward = expandTo18Decimals(7_000_000);
    const round3TotalRewardPerDay = round3TotalReward.div(rewardDurationInDays);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, round3TotalReward)).not.to.be.reverted;
    await expect(lsdCoin.connect(Alice).approve(aaveEthStakingPool.address, round3TotalReward)).not.to.be.reverted;
    await expect(aaveEthStakingPool.connect(Alice).addRewards(round3TotalReward))
      .to.emit(aaveEthStakingPool, 'RewardAdded').withArgs(round3TotalReward);
    expect(await aaveEthStakingPool.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * rewardDurationInDays);

    // Fast-forward 1 more day. Bob gets all the reward
    await time.increase(ONE_DAY_IN_SECS);
    expectBigNumberEquals(bobRewardsTillRound2.add(round3TotalRewardPerDay), await aaveEthStakingPool.earned(Bob.address));

    // Fast-forward to period finish
    await time.increaseTo(await aaveEthStakingPool.periodFinish());

    // Admin should be able to withdraw redundant staking tokens
    // console.log(ethers.utils.formatEther(await provider.getBalance(aaveEthStakingPool.address)));
    await expect(aaveEthStakingPool.connect(Bob).withdrawAdminRewards(Bob.address))
      .to.be.rejectedWith(/Ownable: caller is not the owner/);

    // Bob should be able to exit
    await expect(aaveEthStakingPool.connect(Bob).exit())
      .to.emit(aaveEthStakingPool, 'Withdrawn').withArgs(Bob.address, anyValue)
      .to.emit(aaveEthStakingPool, 'RewardPaid').withArgs(Bob.address, anyValue);
    expect(await aaveEthStakingPool.totalSupply()).to.equal(0);
    expect(await aaveEthStakingPool.balanceOf(Bob.address)).to.equal(0);

  });

});