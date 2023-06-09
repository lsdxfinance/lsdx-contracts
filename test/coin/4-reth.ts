import _ from 'lodash';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployLsdxContractsFixture } from '../utils';
import { StafiUserDeposit__factory, StafiNetworkBalances__factory, RETHToken__factory } from '../../typechain';

const { provider } = ethers;

describe('rETH', () => {

  it('rETH works', async () => {
    const { Alice, Bob } = await loadFixture(deployLsdxContractsFixture);

    const StafiStorage = await ethers.getContractFactory('StafiStorage');
    const stafiStorage = await StafiStorage.deploy();

    const StafiUpgrade = await ethers.getContractFactory('StafiUpgrade');
    const StafiUpgradeContract = await StafiUpgrade.deploy(stafiStorage.address);
    await StafiUpgradeContract.initThisContract();

    const StafiEther = await ethers.getContractFactory('StafiEther');
    const StafiEtherContract = await StafiEther.deploy(stafiStorage.address);
    await StafiUpgradeContract.addContract("stafiEther", StafiEtherContract.address);

    const StafiNetworkBalances = await ethers.getContractFactory('StafiNetworkBalances');
    const StafiNetworkBalancesContract = await StafiNetworkBalances.deploy(stafiStorage.address);
    await StafiUpgradeContract.addContract("stafiNetworkBalances", StafiNetworkBalancesContract.address);
    const stafiNetworkBalances = StafiNetworkBalances__factory.connect(StafiNetworkBalancesContract.address, provider);

    const StafiUserDeposit = await ethers.getContractFactory('StafiUserDeposit');
    const StafiUserDepositContract = await StafiUserDeposit.deploy(stafiStorage.address);
    await StafiUpgradeContract.addContract("stafiUserDeposit", StafiUserDepositContract.address)
    const stafiUserDeposit = StafiUserDeposit__factory.connect(StafiUserDepositContract.address, provider);

    const RETHToken = await ethers.getContractFactory('RETHToken');
    const RETHTokenContract = await RETHToken.deploy(stafiStorage.address);
    await StafiUpgradeContract.addContract("rETHToken", RETHTokenContract.address)
    const rETH = RETHToken__factory.connect(RETHTokenContract.address, provider);
  
    expect(await rETH.getExchangeRate()).to.equal(ethers.utils.parseEther('1'));

    const bobStakeAmount = ethers.utils.parseEther('1');
    await stafiUserDeposit.connect(Alice).setAssignDepositsEnabled(false);
    expect(await stafiUserDeposit.connect(Bob).deposit({value: bobStakeAmount})).not.to.be.reverted;

    expect(await rETH.getExchangeRate()).to.equal(ethers.utils.parseEther('1'));
    expect(await rETH.balanceOf(Bob.address)).to.equal(bobStakeAmount);

    await stafiNetworkBalances.connect(Alice).testSyncUserDeposits(bobStakeAmount, bobStakeAmount);
    // console.log(await stafiNetworkBalances.getTotalETHBalance(), await stafiNetworkBalances.getTotalRETHSupply());

    const ethRewardsAmount = ethers.utils.parseEther('0.5');
    expect(await stafiNetworkBalances.connect(Alice).testDepositEthRewards({value: ethRewardsAmount})).not.to.be.reverted;
    expect(await rETH.getExchangeRate()).to.equal(ethers.utils.parseEther('1.5'));
  });

});