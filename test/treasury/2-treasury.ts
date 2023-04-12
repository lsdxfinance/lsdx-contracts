import _ from 'lodash';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { LsdxTreasury__factory } from '../../typechain/factories/contracts/treasury/LsdxTreasury__factory';
import { ONE_DAY_IN_SECS, deployStakingPoolContractsFixture, expandTo18Decimals, expectBigNumberEquals } from '../utils';

const { provider, BigNumber } = ethers;

describe('LSDx Treansury', () => {

  it('E2E scenario works', async () => {

    const { lsdCoin, veLSD, erc20, weth, Alice, Bob, Caro } = await loadFixture(deployStakingPoolContractsFixture);
    const ethx = erc20;

    // Deploy LsdxTreasury
    const LsdxTreasury = await ethers.getContractFactory('LsdxTreasury');
    const LsdxTreasuryContract = await LsdxTreasury.deploy(lsdCoin.address, [lsdCoin.address, ethx.address], veLSD.address);
    const lsdxTreasury = LsdxTreasury__factory.connect(LsdxTreasuryContract.address, provider);
    expect(await lsdxTreasury.isSupportedRewardToken(ethx.address)).to.equal(true);
    expect(await lsdxTreasury.isSupportedRewardToken(weth.address)).to.equal(false);

    // Need set LsdxTreasury as veLSD minter
    await expect(veLSD.connect(Alice).setMinter(lsdxTreasury.address))
      .to.emit(veLSD, 'MintershipTransferred').withArgs(Alice.address, lsdxTreasury.address);

    // Day 0
    const genesisTime = await time.latest();

    await expect(lsdCoin.connect(Alice).mint(Bob.address, expandTo18Decimals(10_000))).not.to.be.reverted;
    await expect(lsdCoin.connect(Alice).mint(Caro.address, expandTo18Decimals(10_000))).not.to.be.reverted;

    // User could deposit $LSD to treasury, even before start rewarding
    let bobStakeAmount = expandTo18Decimals(1_000);
    await expect(lsdCoin.connect(Bob).approve(lsdxTreasury.address, bobStakeAmount)).not.to.be.reverted;
    let trans = await lsdxTreasury.connect(Bob).depositAndLockToken(bobStakeAmount);
    await trans.wait();
    const bobFirstDepositTime = (await provider.getBlock(trans.blockNumber!)).timestamp;
    expect(await lsdxTreasury.totalSupply()).to.equal(bobStakeAmount);
    expect(await lsdxTreasury.balanceOf(Bob.address)).to.equal(bobStakeAmount);
    expect(await lsdCoin.balanceOf(Bob.address)).to.equal(expandTo18Decimals(10_000 - 1_000));
    expect(await veLSD.balanceOf(Bob.address)).to.equal(bobStakeAmount);

    // Day 1. Bob did another stake.
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS);
    bobStakeAmount = expandTo18Decimals(2_000);
    await expect(lsdCoin.connect(Bob).approve(lsdxTreasury.address, bobStakeAmount)).not.to.be.reverted;
    trans = await lsdxTreasury.connect(Bob).depositAndLockToken(bobStakeAmount);
    await trans.wait();
    const bobSecondDepositTime = (await provider.getBlock(trans.blockNumber!)).timestamp;
    expect(await lsdxTreasury.balanceOf(Bob.address)).to.equal(expandTo18Decimals(1_000 + 2_000));
    expect(await lsdCoin.balanceOf(Bob.address)).to.equal(expandTo18Decimals(10_000 - 1_000 - 2_000));
    expect(await veLSD.balanceOf(Bob.address)).to.equal(expandTo18Decimals(3_000));

    // Check Bob's locked velsd
    expect(await lsdxTreasury.velsdLockedCount(Bob.address)).to.equal(2);
    const firstLock = _.pick(await lsdxTreasury.velsdLockedInfoByIndex(Bob.address, 0), ['lockId', 'amount', 'depositTime', 'unlockTime']);
    expect(firstLock).to.deep.equal({
      lockId: BigNumber.from(1),
      amount: expandTo18Decimals(1_000),
      depositTime: BigNumber.from(bobFirstDepositTime)
    });
    const secondLock = _.pick(await lsdxTreasury.velsdLockedInfoByIndex(Bob.address, 1), ['lockId', 'amount', 'depositTime', 'unlockTime']);
    expect(secondLock).to.deep.equal({
      lockId: BigNumber.from(2),
      amount: expandTo18Decimals(2_000),
      depositTime: BigNumber.from(bobSecondDepositTime)
    });

    // Rewards is 0
    expect(await lsdxTreasury.earned(Bob.address, lsdCoin.address)).to.equal(0);
    expect(await lsdxTreasury.earned(Bob.address, ethx.address)).to.equal(0);
    await expect(lsdxTreasury.earned(Bob.address, weth.address)).to.be.rejectedWith(/Reward token not supported/);
    // await expect(lsdxTreasury.connect(Bob).withdrawFirstSumOfUnlockedToken()).to.be.rejectedWith(/No unlocked deposit to withdraw/);

    // Day 2. Admin deposit 3_000_000 $LSD as rewards, last for 3 days (1_000_000 per day)
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 2);
    const lsdRewardsFor3Days = expandTo18Decimals(3_000_000);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, lsdRewardsFor3Days)).not.to.be.reverted;
    await expect(lsdCoin.connect(Alice).approve(lsdxTreasury.address, lsdRewardsFor3Days)).not.to.be.reverted;
    await expect(lsdxTreasury.connect(Alice).addRewards(lsdCoin.address, lsdRewardsFor3Days, 3))
      .to.emit(lsdxTreasury, 'RewardsAdded').withArgs(lsdCoin.address, Alice.address, lsdRewardsFor3Days, ONE_DAY_IN_SECS * 3);
    expect(await lsdxTreasury.periodFinish(lsdCoin.address)).to.equal(await time.latest() + ONE_DAY_IN_SECS * 3);

    // Day 3. Bob get all the rewards, 1_000_000 $LSD
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 3);
    expectBigNumberEquals(lsdRewardsFor3Days.div(3), await lsdxTreasury.earned(Bob.address, lsdCoin.address));
    // Bob claim 1_000_000 $LSD rewards
    let lsdBalanceBob = await lsdCoin.balanceOf(Bob.address)
    await expect(lsdxTreasury.connect(Bob).getRewards())
      .to.emit(lsdxTreasury, 'RewardsPaid').withArgs(Bob.address, lsdCoin.address, anyValue);
    expect(await lsdxTreasury.earned(Bob.address, lsdCoin.address)).to.equal(0);
    expectBigNumberEquals(await lsdCoin.balanceOf(Bob.address), lsdBalanceBob.add(lsdRewardsFor3Days.div(3)));

    // Day 4. Admin deposit 14_000_1000 $ETHx as rewards, last for 7 days (2_000_000 per day)
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 4);
    const ethxRewardsFor7Days = expandTo18Decimals(14_000_000);
    await expect(ethx.connect(Alice).mint(Alice.address, ethxRewardsFor7Days)).not.to.be.reverted;
    await expect(ethx.connect(Alice).approve(lsdxTreasury.address, ethxRewardsFor7Days)).not.to.be.reverted;
    await expect(lsdxTreasury.connect(Alice).addRewards(ethx.address, ethxRewardsFor7Days, 7))
      .to.emit(lsdxTreasury, 'RewardsAdded').withArgs(ethx.address, Alice.address, ethxRewardsFor7Days, ONE_DAY_IN_SECS * 7);
    expect(await lsdxTreasury.periodFinish(ethx.address)).to.equal(await time.latest() + ONE_DAY_IN_SECS * 7);

    // Caro stakes 1_000 $LSD. Now, Bob earns 3/4 rewards, and Caro earns 1/4 rewards
    const caroStakeAmount = expandTo18Decimals(1_000);
    await expect(lsdCoin.connect(Caro).approve(lsdxTreasury.address, caroStakeAmount)).not.to.be.reverted;
    trans = await lsdxTreasury.connect(Caro).depositAndLockToken(caroStakeAmount);
    await trans.wait();
    // const caroDepositTime = (await provider.getBlock(trans.blockNumber!)).timestamp;
    expect(await lsdxTreasury.balanceOf(Caro.address)).to.equal(expandTo18Decimals(1_000));
    expect(await lsdCoin.balanceOf(Caro.address)).to.equal(expandTo18Decimals(10_000 - 1_000));
    expect(await veLSD.balanceOf(Caro.address)).to.equal(expandTo18Decimals(1_000));

    // Day 5. $LSD rewards are all distrubuted.
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 5);
    expectBigNumberEquals(lsdRewardsFor3Days.div(3).mul(7).div(4), await lsdxTreasury.earned(Bob.address, lsdCoin.address));
    expectBigNumberEquals(lsdRewardsFor3Days.div(3).mul(1).div(4), await lsdxTreasury.earned(Caro.address, lsdCoin.address));
    expectBigNumberEquals(ethxRewardsFor7Days.div(7).mul(3).div(4), await lsdxTreasury.earned(Bob.address, ethx.address));
    expectBigNumberEquals(ethxRewardsFor7Days.div(7).mul(1).div(4), await lsdxTreasury.earned(Caro.address, ethx.address));

    // Day 6. Admin add `weth` as a new rewarding token
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 6);
    await expect(lsdxTreasury.connect(Alice).addRewardToken(weth.address)).to.emit(lsdxTreasury, 'RewardTokenAdded').withArgs(weth.address);
    // Add Caro as `rewarder` to add rewards
    const wethRewardsFor7Days = ethers.utils.parseEther('70');
    await expect(weth.connect(Caro).deposit({value: wethRewardsFor7Days})).not.to.be.reverted;
    await expect(weth.connect(Caro).approve(lsdxTreasury.address, wethRewardsFor7Days)).not.to.be.reverted;
    await expect(lsdxTreasury.connect(Caro).addRewards(weth.address, wethRewardsFor7Days, 7)).to.be.rejectedWith(/Not a rewarder/);
    await expect(lsdxTreasury.connect(Alice).addRewarder(Caro.address)).to.emit(lsdxTreasury, 'RewarderAdded').withArgs(Caro.address);
    await expect(lsdxTreasury.connect(Caro).addRewards(weth.address, wethRewardsFor7Days, 7))
      .to.emit(lsdxTreasury, 'RewardsAdded').withArgs(weth.address, Caro.address, wethRewardsFor7Days, ONE_DAY_IN_SECS * 7);
    expect(await lsdxTreasury.periodFinish(weth.address)).to.equal(await time.latest() + ONE_DAY_IN_SECS * 7);

    // Day 7.
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 7);
    expectBigNumberEquals(lsdRewardsFor3Days.div(3).mul(7).div(4), await lsdxTreasury.earned(Bob.address, lsdCoin.address));
    expectBigNumberEquals(lsdRewardsFor3Days.div(3).mul(1).div(4), await lsdxTreasury.earned(Caro.address, lsdCoin.address));
    expectBigNumberEquals(ethxRewardsFor7Days.div(7).mul(9).div(4), await lsdxTreasury.earned(Bob.address, ethx.address));
    expectBigNumberEquals(ethxRewardsFor7Days.div(7).mul(3).div(4), await lsdxTreasury.earned(Caro.address, ethx.address));
    expectBigNumberEquals(wethRewardsFor7Days.div(7).mul(3).div(4), await lsdxTreasury.earned(Bob.address, weth.address));
    expectBigNumberEquals(wethRewardsFor7Days.div(7).mul(1).div(4), await lsdxTreasury.earned(Caro.address, weth.address));

    // Day 8. Now, 
    // $LSD rewarding: 6/3 days passed, finished days ago
    // $ethx rewarding: 4/7 days passed, 3/7 rewards remaining
    // $weth rewarding: 2/7 days passed, 5/7 rewards remaining (50 weth)
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 8);
    await expect(lsdxTreasury.connect(Bob).getRewards()).not.to.be.reverted;
    await expect(lsdxTreasury.connect(Caro).getRewards()).not.to.be.reverted;
    // For $LSD rewarding, we start a new 7 days rewarding; Now, daily $LSD rewards is 1_000_000
    const lsdRewardsFor7Days = expandTo18Decimals(7_000_000);
    await expect(lsdCoin.connect(Alice).mint(Caro.address, lsdRewardsFor7Days)).not.to.be.reverted;
    await expect(lsdCoin.connect(Caro).approve(lsdxTreasury.address, lsdRewardsFor7Days)).not.to.be.reverted;
    await expect(lsdxTreasury.connect(Caro).addRewards(lsdCoin.address, lsdRewardsFor7Days, 7))
      .to.emit(lsdxTreasury, 'RewardsAdded').withArgs(lsdCoin.address, Caro.address, lsdRewardsFor7Days, ONE_DAY_IN_SECS * 7);
    expect(await lsdxTreasury.periodFinish(lsdCoin.address)).to.equal(await time.latest() + ONE_DAY_IN_SECS * 7);
    // For $weth, we start a new 10 days rewarding; Now daily $weth rewards is (50 + 50) / 5 = 20
    const wethRewardsFor10Days = ethers.utils.parseEther('50');
    const totalWethRewardsFor10Days = ethers.utils.parseEther('100');
    await expect(weth.connect(Alice).deposit({value: wethRewardsFor10Days})).not.to.be.reverted;
    await expect(weth.connect(Alice).approve(lsdxTreasury.address, wethRewardsFor10Days)).not.to.be.reverted;
    await expect(lsdxTreasury.connect(Alice).addRewards(weth.address, wethRewardsFor10Days, 10))
      .to.emit(lsdxTreasury, 'RewardsAdded').withArgs(weth.address, Alice.address, wethRewardsFor10Days, ONE_DAY_IN_SECS * 10);
    expect(await lsdxTreasury.periodFinish(weth.address)).to.equal(await time.latest() + ONE_DAY_IN_SECS * 10);

    // Day 9
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 9);
    expectBigNumberEquals(lsdRewardsFor7Days.div(7).mul(3).div(4), await lsdxTreasury.earned(Bob.address, lsdCoin.address));
    expectBigNumberEquals(lsdRewardsFor7Days.div(7).mul(1).div(4), await lsdxTreasury.earned(Caro.address, lsdCoin.address));
    expectBigNumberEquals(ethxRewardsFor7Days.div(7).mul(3).div(4), await lsdxTreasury.earned(Bob.address, ethx.address));
    expectBigNumberEquals(ethxRewardsFor7Days.div(7).mul(1).div(4), await lsdxTreasury.earned(Caro.address, ethx.address));
    expectBigNumberEquals(totalWethRewardsFor10Days.div(10).mul(3).div(4), await lsdxTreasury.earned(Bob.address, weth.address));
    expectBigNumberEquals(totalWethRewardsFor10Days.div(10).mul(1).div(4), await lsdxTreasury.earned(Caro.address, weth.address));

    // Day 10. Bob withdraw his first deposit, and should have 50% penalty
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 10);
    expect(await lsdxTreasury.adminFee()).to.equal(0);
    let balanceBob = await lsdxTreasury.balanceOf(Bob.address);
    lsdBalanceBob = await lsdCoin.balanceOf(Bob.address);
    let velsdBalanceBob = await veLSD.balanceOf(Bob.address);
    await expect(lsdxTreasury.connect(Bob).withdrawFirstSumOfLockedToken())
      .to.emit(lsdCoin, 'Transfer').withArgs(lsdxTreasury.address, Bob.address, expandTo18Decimals(500))
      .to.emit(veLSD, 'Transfer').withArgs(Bob.address, ethers.constants.AddressZero, expandTo18Decimals(1_000))
      .to.emit(lsdxTreasury, 'Withdrawn').withArgs(Bob.address, expandTo18Decimals(1_000), expandTo18Decimals(500))
      .to.emit(lsdxTreasury, 'AdminFeeAccrued').withArgs(Bob.address, expandTo18Decimals(1_000), expandTo18Decimals(500));
    expect(await lsdxTreasury.balanceOf(Bob.address)).to.equal(balanceBob.sub(expandTo18Decimals(1_000)));
    expect(await lsdCoin.balanceOf(Bob.address)).to.equal(lsdBalanceBob.add(expandTo18Decimals(500)));
    expect(await veLSD.balanceOf(Bob.address)).to.equal(velsdBalanceBob.sub(expandTo18Decimals(1_000)));
    expect(await lsdxTreasury.velsdLockedCount(Bob.address)).to.equal(1);
    expect(await lsdxTreasury.adminFee()).to.equal(expandTo18Decimals(500));

    // Withdraw admin fee
    await expect(lsdxTreasury.connect(Bob).withdrawAdminFee(Bob.address)).to.be.rejectedWith(/Not a rewarder/);
    await expect(lsdxTreasury.connect(Alice).addRewarder(Bob.address)).to.emit(lsdxTreasury, 'RewarderAdded').withArgs(Bob.address);
    await expect(lsdxTreasury.connect(Bob).withdrawAdminFee(Caro.address))
      .to.emit(lsdCoin, 'Transfer').withArgs(lsdxTreasury.address, Caro.address, expandTo18Decimals(500))
      .to.emit(lsdxTreasury, 'AdminFeeWithdrawn').withArgs(Bob.address, Caro.address, expandTo18Decimals(500));
    expect(await lsdxTreasury.adminFee()).to.equal(0);

    // Day 32. Bob withdraw his second deposit, and should have 35% penalty
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 32);
    balanceBob = await lsdxTreasury.balanceOf(Bob.address);
    velsdBalanceBob = await veLSD.balanceOf(Bob.address);
    await expect(lsdxTreasury.connect(Bob).exitFirstSumOfLockedToken())
      .to.emit(lsdCoin, 'Transfer').withArgs(lsdxTreasury.address, Bob.address, expandTo18Decimals(1_300))
      .to.emit(veLSD, 'Transfer').withArgs(Bob.address, ethers.constants.AddressZero, expandTo18Decimals(2_000))
      .to.emit(lsdxTreasury, 'Withdrawn').withArgs(Bob.address, expandTo18Decimals(2_000), expandTo18Decimals(700))
      .to.emit(lsdxTreasury, 'AdminFeeAccrued').withArgs(Bob.address, expandTo18Decimals(2_000), expandTo18Decimals(700))
      .to.emit(lsdxTreasury, 'RewardsPaid').withArgs(Bob.address, lsdCoin.address, anyValue)
      .to.emit(lsdxTreasury, 'RewardsPaid').withArgs(Bob.address, ethx.address, anyValue)
      .to.emit(lsdxTreasury, 'RewardsPaid').withArgs(Bob.address, weth.address, anyValue);
    expect(await lsdxTreasury.balanceOf(Bob.address)).to.equal(balanceBob.sub(expandTo18Decimals(2_000)));
    expect(await veLSD.balanceOf(Bob.address)).to.equal(velsdBalanceBob.sub(expandTo18Decimals(2_000)));
    expect(await lsdxTreasury.velsdLockedCount(Bob.address)).to.equal(0);
    expect(await lsdxTreasury.adminFee()).to.equal(expandTo18Decimals(700));

    // Day 380. Caro should be able to withdraw with no penalty
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 380);
    await expect(lsdxTreasury.connect(Caro).exitFirstSumOfLockedToken())
      .to.emit(lsdCoin, 'Transfer').withArgs(lsdxTreasury.address, Caro.address, expandTo18Decimals(1_000))
      .to.emit(veLSD, 'Transfer').withArgs(Caro.address, ethers.constants.AddressZero, expandTo18Decimals(1_000))
      .to.emit(lsdxTreasury, 'Withdrawn').withArgs(Caro.address, expandTo18Decimals(1_000), 0)
      .to.emit(lsdxTreasury, 'RewardsPaid').withArgs(Caro.address, lsdCoin.address, anyValue)
      .to.emit(lsdxTreasury, 'RewardsPaid').withArgs(Caro.address, ethx.address, anyValue)
      .to.emit(lsdxTreasury, 'RewardsPaid').withArgs(Caro.address, weth.address, anyValue);
    expect(await lsdxTreasury.adminFee()).to.equal(expandTo18Decimals(700));

  });

});