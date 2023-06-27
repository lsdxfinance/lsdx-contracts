import _ from 'lodash';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { ONE_DAY_IN_SECS, deployLsdxV2ContractsFixture, expandTo18Decimals, expectBigNumberEquals } from '../utils';

const { provider } = ethers;

describe('Boostable Farm', () => {

  it('Basic farming works', async () => {

    const { lsdCoin, esLSD, ethx, boostableFarm, Alice, Bob, Caro } = await loadFixture(deployLsdxV2ContractsFixture);

    // Day 0
    const genesisTime = await time.latest();
    await expect(ethx.connect(Alice).mint(Bob.address, expandTo18Decimals(10_000))).not.to.be.reverted;
    await expect(ethx.connect(Alice).mint(Caro.address, expandTo18Decimals(10_000))).not.to.be.reverted;

    // User could deposit $ETHx even before start rewarding
    let bobStakeAmount = expandTo18Decimals(1_000);
    await expect(ethx.connect(Bob).approve(boostableFarm.address, bobStakeAmount)).not.to.be.reverted;
    let trans = await boostableFarm.connect(Bob).stake(bobStakeAmount);
    await trans.wait();
    const bobFirstDepositTime = (await provider.getBlock(trans.blockNumber as number)).timestamp;
    expect(await boostableFarm.totalSupply()).to.equal(bobStakeAmount);
    expect(await boostableFarm.balanceOf(Bob.address)).to.equal(bobStakeAmount);
    expect(await ethx.balanceOf(Bob.address)).to.equal(expandTo18Decimals(10_000 - 1_000));

    // Day 1. Bob did another stake.
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS);
    bobStakeAmount = expandTo18Decimals(2_000);
    await expect(ethx.connect(Bob).approve(boostableFarm.address, bobStakeAmount)).not.to.be.reverted;
    trans = await boostableFarm.connect(Bob).stake(bobStakeAmount);
    await trans.wait();
    const bobSecondDepositTime = (await provider.getBlock(trans.blockNumber as number)).timestamp;
    expect(await boostableFarm.balanceOf(Bob.address)).to.equal(expandTo18Decimals(1_000 + 2_000));
    expect(await ethx.balanceOf(Bob.address)).to.equal(expandTo18Decimals(10_000 - 1_000 - 2_000));

    // Rewards is 0
    expect(await boostableFarm.earned(Bob.address)).to.equal(0);

    // Day 2. Admin deposit 3_000_000 $esLSD as rewards, last for 3 days (1_000_000 per day)
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 2);
    const eslsdRewardsFor3Days = expandTo18Decimals(3_000_000);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, eslsdRewardsFor3Days)).not.to.be.reverted;
    await expect(lsdCoin.connect(Alice).approve(esLSD.address, eslsdRewardsFor3Days)).not.to.be.reverted;
    await expect(esLSD.connect(Alice).escrow(eslsdRewardsFor3Days)).not.to.be.rejected;
    await expect(esLSD.connect(Alice).approve(boostableFarm.address, eslsdRewardsFor3Days)).not.to.be.reverted;
    await expect(boostableFarm.connect(Alice).addRewards(eslsdRewardsFor3Days, 3))
      .to.emit(boostableFarm, 'RewardAdded').withArgs(eslsdRewardsFor3Days, ONE_DAY_IN_SECS * 3);
    expect(await boostableFarm.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * 3);

    // Day 3. Bob get all the rewards, 1_000_000 $esLSD
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 3);
    expectBigNumberEquals(eslsdRewardsFor3Days.div(3), await boostableFarm.earned(Bob.address));
    // Bob claim 1_000_000 $esLSD rewards
    let eslsdBalanceBob = await esLSD.balanceOf(Bob.address)
    await expect(boostableFarm.connect(Bob).getReward())
      .to.emit(boostableFarm, 'RewardPaid').withArgs(Bob.address, anyValue);
    expect(await boostableFarm.earned(Bob.address)).to.equal(0);
    expectBigNumberEquals(await esLSD.balanceOf(Bob.address), eslsdBalanceBob.add(eslsdRewardsFor3Days.div(3)));

    // Caro stakes 1_000 $ETHx. Now, Bob earns 3/4 rewards, and Caro earns 1/4 rewards
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 4);
    const caroStakeAmount = expandTo18Decimals(1_000);
    await expect(ethx.connect(Caro).approve(boostableFarm.address, caroStakeAmount)).not.to.be.reverted;
    trans = await boostableFarm.connect(Caro).stake(caroStakeAmount);
    await trans.wait();
    expect(await boostableFarm.balanceOf(Caro.address)).to.equal(expandTo18Decimals(1_000));
    expect(await ethx.balanceOf(Caro.address)).to.equal(expandTo18Decimals(10_000 - 1_000));

    // Day 5. $esLSD rewards are all distrubuted.
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 5);
    expectBigNumberEquals(eslsdRewardsFor3Days.div(3).mul(7).div(4), await boostableFarm.earned(Bob.address));
    expectBigNumberEquals(eslsdRewardsFor3Days.div(3).mul(1).div(4), await boostableFarm.earned(Caro.address));

    // Day 7.
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 7);
    expectBigNumberEquals(eslsdRewardsFor3Days.div(3).mul(7).div(4), await boostableFarm.earned(Bob.address));
    expectBigNumberEquals(eslsdRewardsFor3Days.div(3).mul(1).div(4), await boostableFarm.earned(Caro.address));

    // Day 8. Now, 
    // $esLSD rewarding: 6/3 days passed, finished days ago
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 8);
    await expect(boostableFarm.connect(Bob).getReward()).not.to.be.reverted;
    await expect(boostableFarm.connect(Caro).getReward()).not.to.be.reverted;

    // For $esLSD rewarding, we start a new 7 days rewarding; Now, daily $esLSD rewards is 1_000_000
    const eslsdRewardsFor7Days = expandTo18Decimals(7_000_000);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, eslsdRewardsFor7Days)).not.to.be.reverted;
    await expect(lsdCoin.connect(Alice).approve(esLSD.address, eslsdRewardsFor7Days)).not.to.be.reverted;
    await expect(esLSD.connect(Alice).escrow(eslsdRewardsFor7Days)).not.to.be.rejected;
    await expect(esLSD.connect(Alice).approve(boostableFarm.address, eslsdRewardsFor7Days)).not.to.be.reverted;
    await expect(boostableFarm.connect(Alice).addRewards(eslsdRewardsFor7Days, 7))
      .to.emit(boostableFarm, 'RewardAdded').withArgs(eslsdRewardsFor7Days, ONE_DAY_IN_SECS * 7);
    expect(await boostableFarm.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * 7);

    // Day 9
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 9);
    expectBigNumberEquals(eslsdRewardsFor7Days.div(7).mul(3).div(4), await boostableFarm.earned(Bob.address));
    expectBigNumberEquals(eslsdRewardsFor7Days.div(7).mul(1).div(4), await boostableFarm.earned(Caro.address));
  });

  it('Reward booster works', async () => {

    const { weth, lsdCoin, esLSD, lsdEthPair, ethxPool, rewardBooster, Alice, Bob, Caro } = await loadFixture(deployLsdxV2ContractsFixture);

    const bobStakes = await rewardBooster.getStakeAmount(Bob.address);
    expect(bobStakes[0].toNumber()).to.equal(0);
    expect(bobStakes[1].toNumber()).to.equal(0);

    const stakePeirod7days = ONE_DAY_IN_SECS * 7;
    expect(await rewardBooster.stakePeriod()).to.equal(stakePeirod7days);

    const baseRate = expandTo18Decimals(1);
    const ethxAmount = expandTo18Decimals(10);
    expect(await rewardBooster.getBoostRate(Bob.address, 0)).to.equal(baseRate);
    expect(await rewardBooster.getBoostRate(Bob.address, ethxAmount)).to.equal(baseRate);

    // Day 0. Bob stakes 10 $LSD-ETH LP tokens. Lock period: [D0 ~ D7]
    const genesisTime = await time.latest();
    const bobStakeAmount = expandTo18Decimals(10);
    await expect(lsdEthPair.connect(Alice).transfer(Bob.address, bobStakeAmount)).not.to.be.reverted;
    await expect(lsdEthPair.connect(Bob).approve(rewardBooster.address, bobStakeAmount)).not.to.be.reverted;
    await expect(rewardBooster.connect(Bob).stake(bobStakeAmount))
      .to.emit(lsdEthPair, 'Transfer').withArgs(Bob.address, rewardBooster.address, bobStakeAmount)
      .to.emit(rewardBooster, 'Stake').withArgs(Bob.address, bobStakeAmount, stakePeirod7days);
    expect((await rewardBooster.getStakeAmount(Bob.address))[1]).to.equal(bobStakeAmount);

    // Set ETHx virtual price to 2.0
    // LSD-ETH reserves, ETH: 1.0, LSD: 1000000.0
    // LSD-ETH LP total supply: 1000.0   ==> 1 LP = 0.001 ETH * 2 = 0.002 ETH
    const lsdEthPoolReserves = await lsdEthPair.getReserves();
    console.log(`LSD-ETH reserves, ETH: ${ethers.utils.formatUnits(lsdEthPoolReserves[0], 18)}, LSD: ${ethers.utils.formatUnits(lsdEthPoolReserves[1], 18)}`);
    console.log(`LSD-ETH LP total supply: ${ethers.utils.formatUnits(await lsdEthPair.totalSupply(), 18)}`);
    let trans = await ethxPool.connect(Alice).set_virtual_price(expandTo18Decimals(2));
    await trans.wait();

    // Expected boost rate: 1 + (10 * 0.002) / (10 * 2.0) = 1.001
    // console.log(`Boosted rate: ${ethers.utils.formatUnits(await rewardBooster.getBoostRate(Bob.address, ethxAmount), 18)}`);
    expect(await rewardBooster.getBoostRate(Bob.address, ethxAmount)).to.equal(baseRate.mul(10010).div(10000));

    // Day 2. Bob stakes another 5 $LSD-ETH LP tokens. Lock period: [D2 ~ D9]
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 2);
    const bobStakeAmount2 = expandTo18Decimals(5);
    await expect(lsdEthPair.connect(Alice).transfer(Bob.address, bobStakeAmount2)).not.to.be.reverted;
    await expect(lsdEthPair.connect(Bob).approve(rewardBooster.address, bobStakeAmount2)).not.to.be.reverted;
    await expect(rewardBooster.connect(Bob).stake(bobStakeAmount2))
      .to.emit(lsdEthPair, 'Transfer').withArgs(Bob.address, rewardBooster.address, bobStakeAmount2)
      .to.emit(rewardBooster, 'Stake').withArgs(Bob.address, bobStakeAmount2, stakePeirod7days);
    expect((await rewardBooster.getStakeAmount(Bob.address))[1]).to.equal(bobStakeAmount.add(bobStakeAmount2));

    // Expected boost rate: 1 + (15 * 0.002) / (10 * 2.0) = 1.0015
    expect(await rewardBooster.getBoostRate(Bob.address, ethxAmount)).to.equal(baseRate.mul(10015).div(10000));

    // Max boost rate: 10
    // Assume Bob stakes 0.001 ETHx, expected boost rate: 1 + (15 * 0.002) / (0.001 * 2.0) = 16
    expect(await rewardBooster.getBoostRate(Bob.address, expandTo18Decimals(1).div(1000))).to.equal(baseRate.mul(10));

    const esBalance = expandTo18Decimals(1_000_000);
    await expect(lsdCoin.connect(Alice).mint(Bob.address, esBalance)).not.to.be.reverted;
    await expect(lsdCoin.connect(Bob).approve(esLSD.address, esBalance)).not.to.be.reverted;
    await expect(esLSD.connect(Bob).escrow(esBalance)).not.to.be.reverted;

    // Day 3. Now Bob has 1_000_000 $esLSD. He choose to vest 9_000 $esLSD, which lasts for 90 days (100 $esLSD per day)
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 3);
    const vestAmount = expandTo18Decimals(9_000);
    const vestPeirod90days = ONE_DAY_IN_SECS * 90;
    await expect(esLSD.connect(Bob).vest(vestAmount))
      .to.emit(esLSD, 'Transfer').withArgs(Bob.address, esLSD.address, vestAmount)
      .to.emit(esLSD, 'Vest').withArgs(Bob.address, vestAmount, vestAmount, vestPeirod90days);

    // Day 4. Bob should have 100 $esLSD unlocked, and 8900 $esLSD vesting
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 4);
    expectBigNumberEquals(await esLSD.claimableAmount(Bob.address), vestAmount.div(90));

    // Now Bos zap vesting $esLSD to $esLSD-ETH LP tokens. Lock period: [D4 ~ D11]
    // LSD-ETH reserves, ETH: 1.0, LSD: 1_000_000.0
    // LSD-ETH LP total supply: 1000.0   ==> 1 LP = 0.001 ETH * 2 = 0.002 ETH
    // $esLSD: 8900, need Pair ETH: 0.0089
    // Expected LP: 8.9
    const bobStakeAmount3 = ethers.utils.parseUnits('8.9', 18);
    // console.log(ethers.utils.formatEther(await provider.getBalance(Bob.address)));
    await expect(esLSD.connect(Bob).zapVest({value: ethers.utils.parseEther('0.0088')})).to.be.rejectedWith(/UniswapV2Router: INSUFFICIENT_A_AMOUNT/);
    await expect(esLSD.connect(Bob).zapVest({value: ethers.utils.parseEther('0.009')}))
      .to.changeEtherBalances([Bob.address, weth.address], [ethers.utils.parseEther('-0.0089'), ethers.utils.parseEther('0.0089')])
      .to.emit(lsdCoin, 'Transfer').withArgs(esLSD.address, Bob.address, vestAmount.div(90))
      .to.emit(esLSD, 'Transfer').withArgs(esLSD.address, ethers.constants.AddressZero, vestAmount.div(90))
      .to.emit(esLSD, 'Claim').withArgs(Bob.address, vestAmount.div(90))
      .to.emit(esLSD, 'Transfer').withArgs(esLSD.address, ethers.constants.AddressZero, vestAmount.div(90).mul(89))
      .to.emit(lsdCoin, 'Transfer').withArgs(esLSD.address, lsdEthPair.address, vestAmount.div(90).mul(89))
      .to.emit(lsdEthPair, 'Transfer').withArgs(esLSD.address, rewardBooster.address, bobStakeAmount3)
      .to.emit(rewardBooster, 'DelegateZapStake').withArgs(Bob.address, bobStakeAmount3, ONE_DAY_IN_SECS * 7)
      .to.emit(esLSD, 'ZapVest').withArgs(Bob.address, vestAmount.div(90).mul(89));

    expect(await esLSD.totalSupply()).to.equal(await lsdCoin.balanceOf(esLSD.address));
    expect(await esLSD.claimableAmount(Bob.address)).to.equal(0);
    expect((await rewardBooster.getStakeAmount(Bob.address))[1]).to.equal(bobStakeAmount.add(bobStakeAmount2).add(bobStakeAmount3));
    // Expected boost rate: 1 + (23.9 * 0.002) / (10 * 2.0) = 1.00239
    expect(await rewardBooster.getBoostRate(Bob.address, ethxAmount)).to.equal(baseRate.mul(100239).div(100000));

    // Day 5. Set ETHx virtual price to 2
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 5); 
    await expect(ethxPool.connect(Alice).set_virtual_price(expandTo18Decimals(2))).not.to.be.reverted;

    // Expected boost rate: 1 + (23.9 * 0.002) / (10 * 2) = 1.00239
    expectBigNumberEquals(await rewardBooster.getBoostRate(Bob.address, ethxAmount), baseRate.mul(100239).div(100000));

    // Day 10. Bob could unstake 15 $LSD-ETH lp tokens
    expect((await rewardBooster.getStakeAmount(Bob.address))[0].toNumber()).to.equal(0);
    await expect(rewardBooster.connect(Bob).unstake()).to.be.rejectedWith(/No tokens to unstake/);
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 10);
    expect((await rewardBooster.getStakeAmount(Bob.address))[0]).to.equal(bobStakeAmount.add(bobStakeAmount2));
    await expect(rewardBooster.connect(Bob).unstake())
      .to.emit(lsdEthPair, 'Transfer').withArgs(rewardBooster.address, Bob.address, bobStakeAmount)
      .to.emit(lsdEthPair, 'Transfer').withArgs(rewardBooster.address, Bob.address, bobStakeAmount2)
      .to.emit(rewardBooster, 'Unstake').withArgs(Bob.address, bobStakeAmount)
      .to.emit(rewardBooster, 'Unstake').withArgs(Bob.address, bobStakeAmount2);
    expect((await rewardBooster.getStakeAmount(Bob.address))[0].toNumber()).to.equal(0);

    // Day 12. Bob could unstake remaining 8.9 LP
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 12);
    expect((await rewardBooster.getStakeAmount(Bob.address))[0]).to.equal(bobStakeAmount3);
    await expect(rewardBooster.connect(Bob).unstake())
      .to.emit(lsdEthPair, 'Transfer').withArgs(rewardBooster.address, Bob.address, bobStakeAmount3)
      .to.emit(rewardBooster, 'Unstake').withArgs(Bob.address, bobStakeAmount3);
    expect((await rewardBooster.getStakeAmount(Bob.address))[0].toNumber()).to.equal(0);
    expect((await rewardBooster.getStakeAmount(Bob.address))[1].toNumber()).to.equal(0);

    // Expected boost rate: 1
    expect(await rewardBooster.getBoostRate(Bob.address, ethxAmount)).to.equal(baseRate);

    // Caro could stake at most 10 sums    
    const caroStakeAmount = expandTo18Decimals(100);
    await expect(lsdEthPair.connect(Alice).transfer(Caro.address, caroStakeAmount)).not.to.be.reverted;
    await expect(lsdEthPair.connect(Caro).approve(rewardBooster.address, caroStakeAmount)).not.to.be.reverted;
    await expect(rewardBooster.connect(Caro).stake(expandTo18Decimals(1))).not.to.be.reverted;
    await expect(rewardBooster.connect(Caro).stake(expandTo18Decimals(2))).not.to.be.reverted;
    await expect(rewardBooster.connect(Caro).stake(expandTo18Decimals(3))).not.to.be.reverted;
    await expect(rewardBooster.connect(Caro).stake(expandTo18Decimals(4))).not.to.be.reverted;
    await expect(rewardBooster.connect(Caro).stake(expandTo18Decimals(5))).not.to.be.reverted;
    await expect(rewardBooster.connect(Caro).stake(expandTo18Decimals(6))).not.to.be.reverted;
    await expect(rewardBooster.connect(Caro).stake(expandTo18Decimals(7))).not.to.be.reverted;
    await expect(rewardBooster.connect(Caro).stake(expandTo18Decimals(8))).not.to.be.reverted;
    await expect(rewardBooster.connect(Caro).stake(expandTo18Decimals(9))).not.to.be.reverted;
    await expect(rewardBooster.connect(Caro).stake(expandTo18Decimals(10))).not.to.be.reverted;
    await expect(rewardBooster.connect(Caro).stake(expandTo18Decimals(11))).to.be.rejectedWith(/Too many stakes/);

    // Unstake all
    await expect(rewardBooster.connect(Caro).unstake()).to.be.rejectedWith(/No tokens to unstake/);
    await time.increase((await rewardBooster.stakePeriod()).toNumber());
    await expect(rewardBooster.connect(Caro).unstake())
      .to.emit(lsdEthPair, 'Transfer').withArgs(rewardBooster.address, Caro.address, expandTo18Decimals(1))
      .to.emit(lsdEthPair, 'Transfer').withArgs(rewardBooster.address, Caro.address, expandTo18Decimals(2))
      .to.emit(lsdEthPair, 'Transfer').withArgs(rewardBooster.address, Caro.address, expandTo18Decimals(3))
      .to.emit(lsdEthPair, 'Transfer').withArgs(rewardBooster.address, Caro.address, expandTo18Decimals(4))
      .to.emit(lsdEthPair, 'Transfer').withArgs(rewardBooster.address, Caro.address, expandTo18Decimals(5))
      .to.emit(lsdEthPair, 'Transfer').withArgs(rewardBooster.address, Caro.address, expandTo18Decimals(6))
      .to.emit(lsdEthPair, 'Transfer').withArgs(rewardBooster.address, Caro.address, expandTo18Decimals(7))
      .to.emit(lsdEthPair, 'Transfer').withArgs(rewardBooster.address, Caro.address, expandTo18Decimals(8))
      .to.emit(lsdEthPair, 'Transfer').withArgs(rewardBooster.address, Caro.address, expandTo18Decimals(9))
      .to.emit(lsdEthPair, 'Transfer').withArgs(rewardBooster.address, Caro.address, expandTo18Decimals(10))
      .to.emit(rewardBooster, 'Unstake').withArgs(Caro.address, expandTo18Decimals(1))
      .to.emit(rewardBooster, 'Unstake').withArgs(Caro.address, expandTo18Decimals(2))
      .to.emit(rewardBooster, 'Unstake').withArgs(Caro.address, expandTo18Decimals(3))
      .to.emit(rewardBooster, 'Unstake').withArgs(Caro.address, expandTo18Decimals(4))
      .to.emit(rewardBooster, 'Unstake').withArgs(Caro.address, expandTo18Decimals(5))
      .to.emit(rewardBooster, 'Unstake').withArgs(Caro.address, expandTo18Decimals(6))
      .to.emit(rewardBooster, 'Unstake').withArgs(Caro.address, expandTo18Decimals(7))
      .to.emit(rewardBooster, 'Unstake').withArgs(Caro.address, expandTo18Decimals(8))
      .to.emit(rewardBooster, 'Unstake').withArgs(Caro.address, expandTo18Decimals(9))
      .to.emit(rewardBooster, 'Unstake').withArgs(Caro.address, expandTo18Decimals(10));

    // Stake are cleared. Able to stake again.
    await expect(rewardBooster.connect(Caro).stake(expandTo18Decimals(1))).not.to.be.reverted;
  });

  it('Boosted farming works', async () => {
    const { lsdCoin, esLSD, ethx, lsdEthPair, ethxPool, boostableFarm, rewardBooster, Alice, Bob, Caro } = await loadFixture(deployLsdxV2ContractsFixture);

    // Day 0
    const genesisTime = await time.latest();
    await expect(ethx.connect(Alice).mint(Bob.address, expandTo18Decimals(10_000))).not.to.be.reverted;
    await expect(ethx.connect(Alice).mint(Caro.address, expandTo18Decimals(10_000))).not.to.be.reverted;

    // Bob stakes 0.3 $ethx, and Caro stakes 0.1 $ethx
    let bobStakeAmount = expandTo18Decimals(3).div(10);
    await expect(ethx.connect(Bob).approve(boostableFarm.address, bobStakeAmount)).not.to.be.reverted;
    await expect(boostableFarm.connect(Bob).stake(bobStakeAmount)).not.to.be.reverted;
    let caroStakeAmount = expandTo18Decimals(1).div(10);
    await expect(ethx.connect(Caro).approve(boostableFarm.address, caroStakeAmount)).not.to.be.reverted;
    await expect(boostableFarm.connect(Caro).stake(caroStakeAmount)).not.to.be.reverted;
    expect(await boostableFarm.totalSupply()).to.equal(bobStakeAmount.add(caroStakeAmount));
    expect(await boostableFarm.balanceOf(Bob.address)).to.equal(bobStakeAmount);
    expect(await boostableFarm.totalBoostedSupply()).to.equal(bobStakeAmount.add(caroStakeAmount));
    expect(await boostableFarm.boostedBalanceOf(Caro.address)).to.equal(caroStakeAmount);

    // Day 2. Admin deposit 7_000_000 $esLSD as rewards, last for 7 days (1_000_000 per day)
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 2);
    const eslsdRewardsFor7Days = expandTo18Decimals(7_000_000);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, eslsdRewardsFor7Days)).not.to.be.reverted;
    await expect(lsdCoin.connect(Alice).approve(esLSD.address, eslsdRewardsFor7Days)).not.to.be.reverted;
    await expect(esLSD.connect(Alice).escrow(eslsdRewardsFor7Days)).not.to.be.rejected;
    await expect(esLSD.connect(Alice).approve(boostableFarm.address, eslsdRewardsFor7Days)).not.to.be.reverted;
    await expect(boostableFarm.connect(Alice).addRewards(eslsdRewardsFor7Days, 7))
      .to.emit(boostableFarm, 'RewardAdded').withArgs(eslsdRewardsFor7Days, ONE_DAY_IN_SECS * 7);
    expect(await boostableFarm.periodFinish()).to.equal(await time.latest() + ONE_DAY_IN_SECS * 7);

    // Day 3. Bob earns 3/4 rewards, and Caro earns 1/4 rewards
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 3);
    expectBigNumberEquals(eslsdRewardsFor7Days.div(7).mul(3).div(4), await boostableFarm.earned(Bob.address));
    expectBigNumberEquals(eslsdRewardsFor7Days.div(7).mul(1).div(4), await boostableFarm.earned(Caro.address));
    await expect(boostableFarm.connect(Bob).getReward()).not.to.be.reverted;
    await expect(boostableFarm.connect(Caro).getReward()).not.to.be.reverted;

    // Set ETHx virtual price to 2.0
    // LSD-ETH reserves, ETH: 1.0, LSD: 1000000.0
    // LSD-ETH LP total supply: 1000.0   ==> 1 LP = 0.001 ETH * 2 = 0.002 ETH
    const lsdEthPoolReserves = await lsdEthPair.getReserves();
    console.log(`LSD-ETH reserves, ETH: ${ethers.utils.formatUnits(lsdEthPoolReserves[0], 18)}, LSD: ${ethers.utils.formatUnits(lsdEthPoolReserves[1], 18)}`);
    console.log(`LSD-ETH LP total supply: ${ethers.utils.formatUnits(await lsdEthPair.totalSupply(), 18)}`);
    await expect(ethxPool.connect(Alice).set_virtual_price(expandTo18Decimals(2))).not.to.be.reverted;

    // Bob stakes 30 $LSD-ETH LP tokens. 
    // Expected boost rate: 1 + (30 * 0.002) / (0.3 * 2.0) = 1.1
    const baseBoostRate = expandTo18Decimals(1);
    const bobStakeAmountLP = expandTo18Decimals(30);
    await expect(lsdEthPair.connect(Alice).transfer(Bob.address, bobStakeAmountLP)).not.to.be.reverted;
    await expect(lsdEthPair.connect(Bob).approve(rewardBooster.address, bobStakeAmountLP)).not.to.be.reverted;
    await expect(rewardBooster.connect(Bob).stake(bobStakeAmountLP)).not.to.be.reverted;
    expect(await rewardBooster.getBoostRate(Bob.address, await boostableFarm.balanceOf(Bob.address))).to.equal(baseBoostRate.mul(11).div(10));

    expect(await boostableFarm.boostedBalanceOf(Bob.address)).to.equal(bobStakeAmount.mul(11).div(10));
    expect(await boostableFarm.totalBoostedSupply()).to.equal(bobStakeAmount.mul(11).div(10).add(caroStakeAmount));

    // Day 4. Bob's reward is boosted. Bob earns 3.3/4.3 rewards, and Caro earns 1/4.3 rewards
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 4);
    expectBigNumberEquals(eslsdRewardsFor7Days.div(7).mul(33).div(43), await boostableFarm.earned(Bob.address));
    expectBigNumberEquals(eslsdRewardsFor7Days.div(7).mul(10).div(43), await boostableFarm.earned(Caro.address));
    await expect(boostableFarm.connect(Bob).getReward()).not.to.be.reverted;
    await expect(boostableFarm.connect(Caro).getReward()).not.to.be.reverted;

    // Bob stakes another 0.1 $ETHx, and is immediately boosted
    let bobStakeAmount2 = expandTo18Decimals(1).div(10);
    await expect(ethx.connect(Bob).approve(boostableFarm.address, bobStakeAmount2)).not.to.be.reverted;
    await expect(boostableFarm.connect(Bob).stake(bobStakeAmount2)).not.to.be.reverted;
    expect(await boostableFarm.balanceOf(Bob.address)).to.equal(bobStakeAmount.add(bobStakeAmount2));

    // With new stakes, Bob's boost rate: 1 + (30 * 0.002) / (0.4 * 2.0) = 1.075
    expect(await boostableFarm.boostedBalanceOf(Bob.address)).to.equal(bobStakeAmount.add(bobStakeAmount2).mul(1075).div(1000));
    expect(await boostableFarm.totalBoostedSupply()).to.equal(bobStakeAmount.add(bobStakeAmount2).mul(1075).div(1000).add(caroStakeAmount));

    // Day 5. Bob's boosted balance: 1.075 * 0.4 = 0.43
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 5);
    expectBigNumberEquals(eslsdRewardsFor7Days.div(7).mul(43).div(53), await boostableFarm.earned(Bob.address));
    expectBigNumberEquals(eslsdRewardsFor7Days.div(7).mul(10).div(53), await boostableFarm.earned(Caro.address));
    await expect(boostableFarm.connect(Bob).getReward()).not.to.be.reverted;
    await expect(boostableFarm.connect(Caro).getReward()).not.to.be.reverted;

    // Bob withdraw 0.1 $ETHx, and boost rate is updated: 1 + (30 * 0.002) / (0.3 * 2.0) = 1.1
    await expect(boostableFarm.connect(Bob).withdraw(bobStakeAmount2)).not.to.be.reverted;
    expect(await boostableFarm.balanceOf(Bob.address)).to.equal(bobStakeAmount);
    expect(await rewardBooster.getBoostRate(Bob.address, await boostableFarm.balanceOf(Bob.address))).to.equal(baseBoostRate.mul(11).div(10));

    // Day 6
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 6);
    expectBigNumberEquals(eslsdRewardsFor7Days.div(7).mul(33).div(43), await boostableFarm.earned(Bob.address));
    expectBigNumberEquals(eslsdRewardsFor7Days.div(7).mul(10).div(43), await boostableFarm.earned(Caro.address));

    // Exit all
    await expect(boostableFarm.connect(Bob).withdraw(await boostableFarm.balanceOf(Bob.address))).not.to.be.reverted;
    expect(await boostableFarm.balanceOf(Bob.address)).to.equal(0);
    expect(await boostableFarm.boostedBalanceOf(Bob.address)).to.equal(0);
  });

});