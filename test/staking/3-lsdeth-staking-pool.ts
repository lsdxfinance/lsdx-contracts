import _ from 'lodash';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { ONE_DAY_IN_SECS, deployStakingPoolContractsFixture, expandTo18Decimals, expectBigNumberEquals } from '../utils';
import { StakingPool__factory } from '../../typechain/factories/contracts/staking/StakingPool__factory';
import { UniswapV2Factory__factory } from '../../typechain/factories/contracts/test/UniswapV2Factory.sol/UniswapV2Factory__factory';
import { UniswapV2Router02__factory } from '../../typechain/factories/contracts/test/UniswapV2Router02.sol/UniswapV2Router02__factory';
import { UniswapV2Pair__factory } from '../../typechain/factories/contracts/test/UniswapV2Factory.sol/UniswapV2Pair__factory';

const { provider } = ethers;

describe('lsd-eth LP Staking Pool', () => {

  it('Basic scenario works', async () => {

    const { lsdCoin, stakingPoolFactory, weth, Alice, Bob, Caro, Dave } = await loadFixture(deployStakingPoolContractsFixture);

    const UniswapV2Factory = await ethers.getContractFactory('UniswapV2Factory');
    const UniswapV2FactoryContract = await UniswapV2Factory.deploy(ethers.constants.AddressZero);
    const uniswapV2Factory = UniswapV2Factory__factory.connect(UniswapV2FactoryContract.address, provider);

    // console.log(await provider.getBalance(Alice.address));
    const UniswapV2Router02 = await ethers.getContractFactory('UniswapV2Router02');
    const UniswapV2Router02Contract = await UniswapV2Router02.deploy(uniswapV2Factory.address, weth.address);
    const uniswapV2Router02 = UniswapV2Router02__factory.connect(UniswapV2Router02Contract.address, provider);

    const uniPairEthAmount = ethers.utils.parseEther('1');
    const uniPairLsdAmount = expandTo18Decimals(1_000_000);
    const uniPairDeadline = (await time.latest()) + ONE_DAY_IN_SECS;
    await expect(lsdCoin.connect(Alice).mint(Alice.address, uniPairLsdAmount)).not.to.be.reverted;

    await expect(lsdCoin.connect(Alice).approve(uniswapV2Router02.address, uniPairLsdAmount)).not.to.be.reverted;
    
    // Note: Update this value to the code hash used in test/UniswapV2Router02.sol:UniswapV2Library.pairFor()
    // const UniswapV2Pair = await ethers.getContractFactory('UniswapV2Pair');
    // console.log(ethers.utils.keccak256(UniswapV2Pair.bytecode));
    let trans = await uniswapV2Router02.connect(Alice).addLiquidityETH(lsdCoin.address, uniPairLsdAmount, uniPairLsdAmount, uniPairEthAmount, Alice.address, uniPairDeadline, {
      value: uniPairEthAmount
    });
    await trans.wait();

    const uniPairAddress = await uniswapV2Factory.getPair(lsdCoin.address, weth.address);
    const lsdeth = UniswapV2Pair__factory.connect(uniPairAddress, provider);
    // console.log(`Alice LP balance: ${await lsdeth.balanceOf(Alice.address)}`);

    // Deploy a staking pool, starting 1 day later, and lasts for 7 days
    const rewardStartTime = (await time.latest()) + ONE_DAY_IN_SECS;
    const rewardDurationInDays = 7;
    await expect(stakingPoolFactory.connect(Alice).deployPool(lsdeth.address, rewardStartTime, rewardDurationInDays))
      .to.emit(stakingPoolFactory, 'StakingPoolDeployed').withArgs(anyValue, lsdeth.address, rewardStartTime, rewardDurationInDays);
    const lsdethStakingPool = StakingPool__factory.connect(await stakingPoolFactory.getStakingPoolAddress(lsdeth.address), provider);
  
    // Trying to deposit rewards before start should fail
    const totalReward = expandTo18Decimals(7_000_000);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, totalReward)).not.to.be.reverted;
    await expect(stakingPoolFactory.connect(Alice).addRewards(lsdethStakingPool.address, totalReward)).to.be.rejectedWith(
      /StakingPoolFactory::addRewards: not ready/,
    );

    // But user should be able to stake now (without rewards)
    await expect(lsdeth.connect(Alice).transfer(Bob.address, expandTo18Decimals(100)))
      .to.emit(lsdeth, 'Transfer').withArgs(Alice.address, Bob.address, expandTo18Decimals(100));
    await expect(lsdeth.connect(Alice).transfer(Caro.address, expandTo18Decimals(100)))
      .to.emit(lsdeth, 'Transfer').withArgs(Alice.address, Caro.address, expandTo18Decimals(100));

    let bobStakeAmount = expandTo18Decimals(90);
    await expect(lsdeth.connect(Bob).approve(lsdethStakingPool.address, bobStakeAmount)).not.to.be.reverted;
    await expect(lsdethStakingPool.connect(Bob).stake(bobStakeAmount)).not.to.be.reverted;
    expect(await lsdethStakingPool.totalSupply()).to.equal(bobStakeAmount);
    expect(await lsdethStakingPool.balanceOf(Bob.address)).to.equal(bobStakeAmount);

    // No rewards now
    await time.increase(ONE_DAY_IN_SECS / 2);
    expect(await lsdethStakingPool.earned(Bob.address)).to.equal(0);

    // Dave accidently transfer some staking token to this contract
    const daveTransferAmount = expandTo18Decimals(10);
    await expect(lsdeth.connect(Alice).transfer(Dave.address, daveTransferAmount))
      .to.emit(lsdeth, 'Transfer').withArgs(Alice.address, Dave.address, daveTransferAmount);
    await expect(lsdeth.connect(Dave).transfer(lsdethStakingPool.address, daveTransferAmount)).not.to.be.reverted;

    // Fast-forward to reward start time, and deposit 7_000_000 $LSD as reward (1_000_000 per day)
    await time.increaseTo(rewardStartTime);
    await expect(lsdCoin.connect(Alice).approve(stakingPoolFactory.address, totalReward)).not.to.be.reverted;
    await expect(stakingPoolFactory.connect(Alice).addRewards(lsdeth.address, totalReward))
      .to.emit(lsdethStakingPool, 'RewardAdded').withArgs(totalReward);
    // Note: The exact `reward start time` is the block timestamp of `addRewards` transaction,
    // which does not exactly equal to `rewardStartTime`
    expect(await lsdethStakingPool.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * rewardDurationInDays);
    expect((await stakingPoolFactory.stakingPoolInfoByStakingToken(lsdeth.address)).totalRewardsAmount).to.equal(totalReward);
    
    const caroStakeAmount = expandTo18Decimals(10);
    await expect(lsdeth.connect(Caro).approve(lsdethStakingPool.address, caroStakeAmount)).not.to.be.reverted;
    await expect(lsdethStakingPool.connect(Caro).stake(caroStakeAmount)).not.to.be.reverted;
    expect(await lsdethStakingPool.totalSupply()).to.equal(bobStakeAmount.add(caroStakeAmount));
    expect(await lsdethStakingPool.balanceOf(Caro.address)).to.equal(caroStakeAmount);

    // 1_000_000 $LSD per day. Fast-forward to generate rewards
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS);
    // await time.increase(ONE_DAY_IN_SECS);
    const totalRewardPerDay = totalReward.div(rewardDurationInDays);
    expectBigNumberEquals(totalRewardPerDay.mul(9).div(10), await lsdethStakingPool.earned(Bob.address));
    expectBigNumberEquals(totalRewardPerDay.mul(1).div(10), await lsdethStakingPool.earned(Caro.address));

    // Dave has no rewards
    expect(await lsdethStakingPool.balanceOf(Dave.address)).to.equal(0);
    expect(await lsdethStakingPool.earned(Dave.address)).to.equal(0);

    // Caro claim $LSD rewards
    await expect(lsdethStakingPool.connect(Caro).getReward())
      .to.emit(lsdethStakingPool, 'RewardPaid').withArgs(Caro.address, anyValue);
    expect(await lsdethStakingPool.earned(Caro.address)).to.equal(0);
    expectBigNumberEquals(await lsdCoin.balanceOf(Caro.address), totalRewardPerDay.mul(1).div(10));

    // Fast-forward 1 day. Bob's reward: 9/10 + 9/10;  Caro's reward: 1/10
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 2);
    expectBigNumberEquals(totalRewardPerDay.mul(18).div(10), await lsdethStakingPool.earned(Bob.address));
    expectBigNumberEquals(totalRewardPerDay.mul(1).div(10), await lsdethStakingPool.earned(Caro.address));

    // Bob withdraw part of his staking coin
    const bobWithdrawAmount = expandTo18Decimals(50);
    bobStakeAmount = expandTo18Decimals(90 - 50);
    // Now Bob's effective staking is 40 and Caro's effective staking is 10
    await expect(lsdethStakingPool.connect(Bob).withdraw(expandTo18Decimals(100))).to.be.reverted;
    await expect(lsdethStakingPool.connect(Bob).withdraw(bobWithdrawAmount))
      .to.emit(lsdethStakingPool, 'Withdrawn').withArgs(Bob.address, bobWithdrawAmount);
    expect(await lsdethStakingPool.totalSupply()).to.equal(bobStakeAmount.add(caroStakeAmount));
    expect(await lsdethStakingPool.balanceOf(Bob.address)).to.equal(bobStakeAmount);
    expect(await lsdethStakingPool.balanceOf(Caro.address)).to.equal(caroStakeAmount);
    
    // Fast-forward 1 day. Bob's reward: 9/10 + 9/10 + 8/10;  Caro's reward: 1/10 + 2/10
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 3);
    expectBigNumberEquals(totalRewardPerDay.mul(26).div(10), await lsdethStakingPool.earned(Bob.address));
    expectBigNumberEquals(totalRewardPerDay.mul(3).div(10), await lsdethStakingPool.earned(Caro.address));

    // 4 days remaining. Now admin could start another round of rewarding.
    // Remaining days are extended to 7;  Reward per day from now on: (7_000_000 * 4 / 7  + 14_000_000) / 7
    const round2TotalReward = expandTo18Decimals(14_000_000);
    const round2TotalRewardPerDay = totalReward.mul(4).div(7).add(round2TotalReward).div(rewardDurationInDays);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, round2TotalReward)).not.to.be.reverted;
    await expect(lsdCoin.connect(Alice).approve(stakingPoolFactory.address, round2TotalReward)).not.to.be.reverted;
    await expect(stakingPoolFactory.connect(Alice).addRewards(lsdeth.address, round2TotalReward))
      .to.emit(lsdethStakingPool, 'RewardAdded').withArgs(round2TotalReward);
    expect(await lsdethStakingPool.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * rewardDurationInDays);
    expect((await stakingPoolFactory.stakingPoolInfoByStakingToken(lsdeth.address)).totalRewardsAmount).to.equal(totalReward.add(round2TotalReward));

    // Fast-forward 1 day. Now every day, Bob get 8/10 rewards, and Caro get 2/10 rewards
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 4);
    const round1BobReward = totalRewardPerDay.mul(26).div(10);
    const round2CaroReward = totalRewardPerDay.mul(3).div(10);
    expectBigNumberEquals(round1BobReward.add(round2TotalRewardPerDay.mul(8).div(10)), await lsdethStakingPool.earned(Bob.address));
    expectBigNumberEquals(round2CaroReward.add(round2TotalRewardPerDay.mul(2).div(10)), await lsdethStakingPool.earned(Caro.address));

    // Caro exit staking
    await expect(lsdethStakingPool.connect(Caro).exit())
      .to.emit(lsdethStakingPool, 'Withdrawn').withArgs(Caro.address, caroStakeAmount)
      .to.emit(lsdethStakingPool, 'RewardPaid').withArgs(Caro.address, anyValue);
    expect(await lsdethStakingPool.totalSupply()).to.equal(bobStakeAmount);
    expect(await lsdethStakingPool.balanceOf(Bob.address)).to.equal(bobStakeAmount);
    expect(await lsdethStakingPool.balanceOf(Caro.address)).to.equal(0);
  
    // Now bob get all the staking rewards
    await time.increaseTo(rewardStartTime + ONE_DAY_IN_SECS * 5);
    expectBigNumberEquals(round1BobReward.add(round2TotalRewardPerDay.mul(18).div(10)), await lsdethStakingPool.earned(Bob.address));
    
    // Fast-forward to round 2 finish
    await time.increaseTo(await lsdethStakingPool.periodFinish());
    const bobRewardsTillRound2 = round1BobReward.add(round2TotalRewardPerDay.mul(68).div(10));
    expectBigNumberEquals(bobRewardsTillRound2, await lsdethStakingPool.earned(Bob.address));

    // Fast-forward 1 more day. No extra rewards are generated
    await time.increaseTo(await (await lsdethStakingPool.periodFinish()).add(ONE_DAY_IN_SECS));
    expectBigNumberEquals(bobRewardsTillRound2, await lsdethStakingPool.earned(Bob.address));

    // Admin start round 3
    const round3TotalReward = expandTo18Decimals(7_000_000);
    const round3TotalRewardPerDay = round3TotalReward.div(rewardDurationInDays);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, round3TotalReward)).not.to.be.reverted;
    await expect(lsdCoin.connect(Alice).approve(stakingPoolFactory.address, round3TotalReward)).not.to.be.reverted;
    await expect(stakingPoolFactory.connect(Alice).addRewards(lsdeth.address, round3TotalReward))
      .to.emit(lsdethStakingPool, 'RewardAdded').withArgs(round3TotalReward);
    expect(await lsdethStakingPool.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * rewardDurationInDays);
    expect((await stakingPoolFactory.stakingPoolInfoByStakingToken(lsdeth.address)).totalRewardsAmount).to.equal(totalReward.add(round2TotalReward).add(round3TotalReward));

    // Fast-forward 1 more day. Bob gets all the reward
    await time.increase(ONE_DAY_IN_SECS);
    expectBigNumberEquals(bobRewardsTillRound2.add(round3TotalRewardPerDay), await lsdethStakingPool.earned(Bob.address));

    // Fast-forward to period finish
    await time.increaseTo(await lsdethStakingPool.periodFinish());

    // Admin should be able to withdraw redundant staking tokens
    await expect(stakingPoolFactory.connect(Bob).withdrawELRewards(lsdeth.address, Bob.address))
      .to.be.rejectedWith(/Ownable: caller is not the owner/);
    await expect(lsdethStakingPool.connect(Bob).withdrawELRewards(Bob.address))
      .to.be.rejectedWith(/Caller is not RewardsDistribution contract/);
    await expect(stakingPoolFactory.connect(Alice).withdrawELRewards(lsdeth.address, Dave.address))
      .to.emit(lsdethStakingPool, 'ELRewardWithdrawn').withArgs(Dave.address, daveTransferAmount);
    expect(await lsdeth.balanceOf(Dave.address)).to.equal(daveTransferAmount);

    // Bob should be able to exit
    await expect(lsdethStakingPool.connect(Bob).exit())
      .to.emit(lsdethStakingPool, 'Withdrawn').withArgs(Bob.address, anyValue)
      .to.emit(lsdethStakingPool, 'RewardPaid').withArgs(Bob.address, anyValue);
    expect(await lsdethStakingPool.totalSupply()).to.equal(0);
    expect(await lsdethStakingPool.balanceOf(Bob.address)).to.equal(0);
  });

});