import _ from 'lodash';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ONE_DAY_IN_SECS, deployLsdxV2ContractsFixture, expandTo18Decimals, expectBigNumberEquals } from '../utils';

const { provider } = ethers;

describe('esLSD Token', () => {

  it('Basic functions work', async () => {
    const { lsdCoin, esLSD, Alice, Bob } = await loadFixture(deployLsdxV2ContractsFixture);

    // Bob $esLSD: 10_000
    const esBalance = expandTo18Decimals(10_000);
    await expect(lsdCoin.connect(Alice).mint(Bob.address, esBalance)).not.to.be.reverted;
    await expect(lsdCoin.connect(Bob).approve(esLSD.address, esBalance)).not.to.be.reverted;
    await expect(esLSD.connect(Bob).escrow(esBalance))
      .to.emit(lsdCoin, 'Transfer').withArgs(Bob.address, esLSD.address, esBalance)
      .to.emit(esLSD, 'Transfer').withArgs(ethers.constants.AddressZero, Bob.address, esBalance)
      .to.emit(esLSD, 'Escrow').withArgs(Bob.address, esBalance);
    expect(await esLSD.balanceOf(Bob.address)).to.equal(esBalance);
    expect(await esLSD.totalSupply()).to.equal(await lsdCoin.balanceOf(esLSD.address));

    // Day 0
    const genesisTime = await time.latest();

    // Bob vest $esLSD, for 90 days
    const vestPeirod90days = ONE_DAY_IN_SECS * 90;
    const vestAmount = expandTo18Decimals(1000);
    expect(await esLSD.vestingPeriod()).to.equal(vestPeirod90days);
    await expect(esLSD.connect(Bob).claim()).to.be.rejectedWith(/No tokens to claim/);
    let trans = await esLSD.connect(Bob).vest(vestAmount);
    await expect(trans)
      .to.emit(esLSD, 'Transfer').withArgs(Bob.address, esLSD.address, vestAmount)
      .to.emit(esLSD, 'Vest').withArgs(Bob.address, vestAmount, vestAmount, vestPeirod90days);
    const vestTimestamp = (await provider.getBlock(trans.blockNumber as number)).timestamp;
    const vestInfo = await esLSD.userVestings(Bob.address);
    expect(vestInfo.amount).to.equal(vestAmount);
    expect(vestInfo.startTime).to.equal(vestTimestamp);
    expect(vestInfo.endTime).to.equal(vestTimestamp + vestPeirod90days);
    expect(await esLSD.claimableAmount(Bob.address)).to.equal(0);
    expect(await esLSD.balanceOf(esLSD.address)).to.equal(vestAmount);
    expect(await esLSD.totalSupply()).to.equal(await lsdCoin.balanceOf(esLSD.address));

    // Day 9. 10% of the vest should be unlocked
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 9);
    const unlockedAmount = vestAmount.div(10);
    expectBigNumberEquals(await esLSD.claimableAmount(Bob.address), unlockedAmount);

    // Claim unlocked
    trans = await esLSD.connect(Bob).claim();
    await expect(trans)
      .to.emit(lsdCoin, 'Transfer').withArgs(esLSD.address, Bob.address, unlockedAmount)
      .to.emit(esLSD, 'Transfer').withArgs(esLSD.address, ethers.constants.AddressZero, unlockedAmount)
      .to.emit(esLSD, 'Claim').withArgs(Bob.address, unlockedAmount);
    const claimTimestamp = (await provider.getBlock(trans.blockNumber as number)).timestamp;
    const vestInfo2 = await esLSD.userVestings(Bob.address);
    expect(vestInfo2.amount).to.equal(vestAmount.sub(unlockedAmount));
    expect(vestInfo2.startTime).to.equal(claimTimestamp);
    expect(vestInfo2.endTime).to.equal(vestInfo.endTime);
    expect(await esLSD.claimableAmount(Bob.address)).to.equal(0);
    expect(await esLSD.totalSupply()).to.equal(await lsdCoin.balanceOf(esLSD.address));

    // Day 18. Anther 10% of the vest should be unlocked
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 18);
    const unlockedAmount2 = vestAmount.div(10);
    expectBigNumberEquals(await esLSD.claimableAmount(Bob.address), unlockedAmount2);

    // Bob vest another 2000 $esLSD. Unlocked $1000 is auto claimed for user.
    const vestAmount2 = expandTo18Decimals(2000);
    trans = await esLSD.connect(Bob).vest(vestAmount2);
    await expect(trans)
      .to.emit(esLSD, 'Transfer').withArgs(Bob.address, esLSD.address, vestAmount2)
      .to.emit(lsdCoin, 'Transfer').withArgs(esLSD.address, Bob.address, unlockedAmount2)
      .to.emit(esLSD, 'Claim').withArgs(Bob.address, unlockedAmount2)
      .to.emit(esLSD, 'Vest').withArgs(Bob.address, vestAmount2, vestAmount2.add(vestAmount.div(10).mul(8)), vestPeirod90days);
    const vestTimestamp2 = (await provider.getBlock(trans.blockNumber as number)).timestamp;
    const vestInfo3 = await esLSD.userVestings(Bob.address);
    expect(vestInfo3.amount).to.equal(vestAmount2.add(vestAmount.div(10).mul(8)));
    expect(vestInfo3.startTime).to.equal(vestTimestamp2);
    expect(vestInfo3.endTime).to.equal(vestTimestamp2 + vestPeirod90days);
    expect(await esLSD.totalSupply()).to.equal(await lsdCoin.balanceOf(esLSD.address));

    // Fast-forward and claim all
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 120);
    const unlockedAmount3 = expandTo18Decimals(2000 + 800);
    expectBigNumberEquals(await esLSD.claimableAmount(Bob.address), unlockedAmount3);
    await expect(await esLSD.connect(Bob).claim())
      .to.emit(lsdCoin, 'Transfer').withArgs(esLSD.address, Bob.address, unlockedAmount3)
      .to.emit(esLSD, 'Transfer').withArgs(esLSD.address, ethers.constants.AddressZero, unlockedAmount3)
      .to.emit(esLSD, 'Claim').withArgs(Bob.address, unlockedAmount3);
    expect(await esLSD.claimableAmount(Bob.address)).to.equal(0);
    await expect(esLSD.connect(Bob).claim()).to.be.rejectedWith(/No tokens to claim/);
    expect(await esLSD.totalSupply()).to.equal(await lsdCoin.balanceOf(esLSD.address));
  });

});