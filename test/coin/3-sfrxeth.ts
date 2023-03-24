import _ from 'lodash';
import { expect } from 'chai';
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployStakingPoolContractsFixture, expandTo18Decimals } from '../utils';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';

describe('sfrxETH', () => {

  it('sfrxETH works', async () => {
    const { frxETH, sfrxETH, Alice, Bob } = await loadFixture(deployStakingPoolContractsFixture);

    // Mint 10 frxETH to Alice and Bob, respectively
    const aliceBobFrxEthAmount = expandTo18Decimals(10);
    await expect(frxETH.connect(Alice).addMinter(Alice.address))
      .to.emit(frxETH, 'MinterAdded').withArgs(Alice.address);
    await expect(frxETH.connect(Alice).minter_mint(Alice.address, aliceBobFrxEthAmount))
      .to.emit(frxETH, 'TokenMinterMinted').withArgs(Alice.address, Alice.address, aliceBobFrxEthAmount);
    await expect(frxETH.connect(Alice).minter_mint(Bob.address, aliceBobFrxEthAmount))
      .to.emit(frxETH, 'TokenMinterMinted').withArgs(Alice.address, Bob.address, aliceBobFrxEthAmount);
    
    // Bob deposit to get 10 sfrxETH
    await expect(frxETH.connect(Bob).approve(sfrxETH.address, aliceBobFrxEthAmount)).not.to.be.reverted;
    await expect(sfrxETH.connect(Bob).deposit(aliceBobFrxEthAmount, Bob.address))
      .to.emit(sfrxETH, 'Deposit').withArgs(Bob.address, Bob.address, aliceBobFrxEthAmount, anyValue);
    const sfrxETHOfBob = await sfrxETH.balanceOf(Bob.address);
    // console.log(sfrxETHOfBob);
    expect(sfrxETHOfBob).to.equal(aliceBobFrxEthAmount);

    // Alice add frxETH rewards to sfrxETH pool
    await expect(frxETH.connect(Alice).transfer(sfrxETH.address, aliceBobFrxEthAmount)).not.to.be.rejected;

    // Bob's sfrxETH balance is not updated
    expect(await sfrxETH.balanceOf(Bob.address)).to.equal(sfrxETHOfBob);
    expect(await sfrxETH.pricePerShare()).to.equal(expandTo18Decimals(1));
    
    // Start to sync rewards
    await time.increase(604800);
    await expect(sfrxETH.connect(Alice).syncRewards()).not.to.be.reverted;
    expect(await sfrxETH.pricePerShare()).to.equal(expandTo18Decimals(1));

    // After a perioud, rewards are synced. `pricePerShare` should be doubled
    await time.increase(604800);
    expect(await sfrxETH.pricePerShare()).to.equal(expandTo18Decimals(2));
    expect(await sfrxETH.balanceOf(Bob.address)).to.equal(sfrxETHOfBob);

    // Bos's sfrxBalance is not updated, but could withdraw more frxETH
    await expect(sfrxETH.connect(Bob).withdraw(sfrxETHOfBob, Bob.address, Bob.address))
      .to.emit(sfrxETH, 'Withdraw').withArgs(Bob.address, Bob.address, Bob.address, sfrxETHOfBob, anyValue);
    expect(await frxETH.balanceOf(Bob.address)).to.equal(expandTo18Decimals(10));
    expect(await sfrxETH.balanceOf(Bob.address)).to.equal(expandTo18Decimals(5));
  });

});