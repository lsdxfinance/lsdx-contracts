import _ from 'lodash';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { LsdxTreasury__factory } from '../../typechain/factories/contracts/treasury/LsdxTreasury__factory';
import { ONE_DAY_IN_SECS, deployStakingPoolContractsFixture, expandTo18Decimals, expectBigNumberEquals, nativeTokenAddress } from '../utils';

const { provider, BigNumber } = ethers;

describe('LSDx Treansury', () => {

  it('E2E scenario works', async () => {

    const { lsdCoin, veLSD, erc20, weth, Alice, Bob, Caro, Dave } = await loadFixture(deployStakingPoolContractsFixture);

    // Deploy LsdxTreasury. Timelock is set to 30 days for testing
    const timelockInDays = 30;
    const LsdxTreasury = await ethers.getContractFactory('LsdxTreasury');
    const LsdxTreasuryContract = await LsdxTreasury.deploy(lsdCoin.address, [lsdCoin.address, erc20.address], veLSD.address, timelockInDays);
    const lsdxTreasury = LsdxTreasury__factory.connect(LsdxTreasuryContract.address, provider);
    expect(await lsdxTreasury.isSupportedRewardToken(erc20.address)).to.equal(true);
    expect(await lsdxTreasury.isSupportedRewardToken(weth.address)).to.equal(false);

    // Need set LsdxTreasury as veLSD minter
    await expect(veLSD.connect(Alice).setMinter(lsdxTreasury.address))
      .to.emit(veLSD, 'MintershipTransferred').withArgs(Alice.address, lsdxTreasury.address);

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

    // Bob did another stake after 1 day
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS);
    bobStakeAmount = expandTo18Decimals(2_000);
    await expect(lsdCoin.connect(Bob).approve(lsdxTreasury.address, bobStakeAmount)).not.to.be.reverted;
    trans = await lsdxTreasury.connect(Bob).depositAndLockToken(bobStakeAmount);
    await trans.wait();
    const bobSecondDepositTime = (await provider.getBlock(trans.blockNumber!)).timestamp;
    expect(await lsdxTreasury.balanceOf(Bob.address)).to.equal(expandTo18Decimals(3_000));

    // Check Bob's locked velsd
    expect(await lsdxTreasury.velsdLockedCount(Bob.address)).to.equal(2);
    const firstLock = _.pick(await lsdxTreasury.velsdLockedInfoByIndex(Bob.address, 0), ['lockId', 'amount', 'startTime', 'unlockTime']);
    expect(firstLock).to.deep.equal({
      lockId: BigNumber.from(1),
      amount: expandTo18Decimals(1_000),
      startTime: BigNumber.from(bobFirstDepositTime),
      unlockTime: BigNumber.from(bobFirstDepositTime).add(timelockInDays * ONE_DAY_IN_SECS)
    });
    const secondLock = _.pick(await lsdxTreasury.velsdLockedInfoByIndex(Bob.address, 1), ['lockId', 'amount', 'startTime', 'unlockTime']);
    expect(secondLock).to.deep.equal({
      lockId: BigNumber.from(2),
      amount: expandTo18Decimals(2_000),
      startTime: BigNumber.from(bobSecondDepositTime),
      unlockTime: BigNumber.from(bobSecondDepositTime).add(timelockInDays * ONE_DAY_IN_SECS)
    });

  });

});