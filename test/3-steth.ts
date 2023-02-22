import _ from 'lodash';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployStakingPoolContractsFixture } from './utils';

describe('stETH', () => {

  it('stETH works', async () => {
    const { stETH, Alice, Bob, Caro } = await loadFixture(deployStakingPoolContractsFixture);

    const bobStakeAmount = ethers.utils.parseEther('1.5');
    await expect(stETH.connect(Bob).submit({value: bobStakeAmount}))
      .to.emit(stETH, 'Transfer').withArgs(0, Bob.address, bobStakeAmount)
      .to.emit(stETH, 'TransferShares').withArgs(0, Bob.address, bobStakeAmount)
      .to.changeEtherBalances([Bob.address, stETH.address], [ethers.utils.parseEther('-1.5'), bobStakeAmount]);
    expect(await stETH.balanceOf(Bob.address)).to.equal(bobStakeAmount);
    // console.log(`Bob share: ${await stETH.sharesOf(Bob.address)}/${await stETH.getTotalShares()}; Caro share: ${await stETH.sharesOf(Caro.address)}/${await stETH.getTotalShares()}`);
    // console.log(`Total ETH: ${await provider.getBalance(stETH.address)}; Bob stETH balance: ${await stETH.balanceOf(Bob.address)}; Caro stETH balance: ${await stETH.balanceOf(Caro.address)}`);

    const caroStakeAmount = ethers.utils.parseEther('0.5');
    await expect(stETH.connect(Caro).submit({value: caroStakeAmount}))
      .to.emit(stETH, 'Transfer').withArgs(0, Caro.address, caroStakeAmount)
      .to.emit(stETH, 'TransferShares').withArgs(0, Caro.address, caroStakeAmount)
      .to.changeEtherBalances([Caro.address, stETH.address], [ethers.utils.parseEther('-0.5'), caroStakeAmount]);
    expect(await stETH.balanceOf(Caro.address)).to.equal(caroStakeAmount);

    // console.log(`Bob share: ${await stETH.sharesOf(Bob.address)}/${await stETH.getTotalShares()}; Caro share: ${await stETH.sharesOf(Caro.address)}/${await stETH.getTotalShares()}`);
    // console.log(`Total ETH: ${await provider.getBalance(stETH.address)}; Bob stETH balance: ${await stETH.balanceOf(Bob.address)}; Caro stETH balance: ${await stETH.balanceOf(Caro.address)}`);

    // Alice deposit staking reward
    const stakingRewards = ethers.utils.parseEther('2');
    await expect(stETH.connect(Alice).receiveELRewards({value: stakingRewards}))
      .to.changeEtherBalances([Alice.address, stETH.address], [ethers.utils.parseEther('-2'), stakingRewards]);

    // Now Bob and Caro's stETH balance should be doubled
    expect(await stETH.balanceOf(Bob.address)).to.equal(ethers.utils.parseEther('3'));
    expect(await stETH.balanceOf(Caro.address)).to.equal(ethers.utils.parseEther('1'));
  });

});