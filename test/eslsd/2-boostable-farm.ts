import _ from 'lodash';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { ONE_DAY_IN_SECS, deployLsdxV2ContractsFixture, expandTo18Decimals, expectBigNumberEquals, nativeTokenAddress } from '../utils';
import { BoostableFarm__factory } from '../../typechain';

const { provider } = ethers;

const dayjs = require('dayjs');

describe('Boostable Farm', () => {

  it('Basic scenario works', async () => {

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

});