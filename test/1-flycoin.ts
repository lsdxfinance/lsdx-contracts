import _ from 'lodash';
import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployStakingPoolContractsFixture } from './utils';

describe('FlyCoin', () => {

  it('Mintable, transferable and burnable', async () => {

    const { flyCoin, Alice, Bob, Caro, Dave } = await loadFixture(deployStakingPoolContractsFixture);

    // Bob: 10_000
    await expect(flyCoin.connect(Alice).mint(Bob.address, 10_000))
      .to.emit(flyCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Bob.address, 10_000);
    expect(await flyCoin.totalSupply()).to.equal(10_000);
    expect(await flyCoin.balanceOf(Bob.address)).to.equal(10_000);

    // Bob: 10_000, Caro: 1_000
    await expect(flyCoin.connect(Alice).mint(Caro.address, 1_000))
      .to.emit(flyCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Caro.address, 1_000);
    expect(await flyCoin.totalSupply()).to.equal(10_000 + 1_000);
    expect(await flyCoin.balanceOf(Caro.address)).to.equal(1_000);

    // Bob: 10_000, Caro: 900, Dave: 100
    await expect(flyCoin.connect(Caro).transfer(Dave.address, 100))
      .to.emit(flyCoin, 'Transfer').withArgs(Caro.address, Dave.address, 100);
    expect(await flyCoin.balanceOf(Caro.address)).to.equal(900);
    expect(await flyCoin.balanceOf(Dave.address)).to.equal(100);

    // Bob: 10_000, Caro: 800, Dave: 100
    await expect(flyCoin.connect(Caro).burn(100))
      .to.emit(flyCoin, 'Transfer').withArgs(Caro.address, ethers.constants.AddressZero, 100);
    expect(await flyCoin.balanceOf(Caro.address)).to.equal(800);

    // Bob: 10_000, Caro: 700, Dave: 200
    await expect(flyCoin.connect(Caro).approve(Dave.address, 100))
      .to.emit(flyCoin, 'Approval').withArgs(Caro.address, Dave.address, 100);
    await expect(flyCoin.connect(Dave).transferFrom(Caro.address, Dave.address, 100))
      .to.emit(flyCoin, 'Transfer').withArgs(Caro.address, Dave.address, 100);
    expect(await flyCoin.balanceOf(Caro.address)).to.equal(700);
    expect(await flyCoin.balanceOf(Dave.address)).to.equal(200);

  });

  it('Access control', async () => {

    const { flyCoin, Alice, Bob } = await loadFixture(deployStakingPoolContractsFixture);

    await expect(flyCoin.connect(Bob).mint(Bob.address, 10_000)).to.be.rejectedWith(
      /AccessControl/,
    );

    const minterRole = await flyCoin.MINTER_ROLE();
    await expect(flyCoin.connect(Alice).grantRole(minterRole, Bob.address))
      .to.emit(flyCoin, 'RoleGranted').withArgs(minterRole, Bob.address, Alice.address);

    await expect(flyCoin.connect(Bob).mint(Bob.address, 10_000))
      .to.emit(flyCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Bob.address, 10_000);

    await expect(flyCoin.connect(Alice).revokeRole(minterRole, Bob.address))
      .to.emit(flyCoin, 'RoleRevoked').withArgs(minterRole, Bob.address, Alice.address);
  
    await expect(flyCoin.connect(Bob).mint(Bob.address, 10_000)).to.be.rejectedWith(
      /AccessControl/,
    );
    
  });

  it('Pausable', async () => {

    const { flyCoin, Alice, Bob, Caro } = await loadFixture(deployStakingPoolContractsFixture);

    await expect(flyCoin.connect(Alice).mint(Bob.address, 10_000))
      .to.emit(flyCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Bob.address, 10_000);

    await expect(flyCoin.connect(Alice).mint(Caro.address, 1_000))
      .to.emit(flyCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Caro.address, 1_000);

    await expect(flyCoin.connect(Bob).transfer(Caro.address, 1_000))
      .to.emit(flyCoin, 'Transfer').withArgs(Bob.address, Caro.address, 1_000);

    await expect(flyCoin.connect(Alice).pause())
      .to.emit(flyCoin, 'Paused').withArgs(Alice.address);

    await expect(flyCoin.connect(Alice).mint(Caro.address, 1_000)).to.be.rejectedWith(
      /Pausable: paused/,
    );

    await expect(flyCoin.connect(Bob).transfer(Caro.address, 1_000)).to.be.rejectedWith(
      /Pausable: paused/,
    );

    await expect(flyCoin.connect(Bob).burn(100)).to.be.rejectedWith(
      /Pausable: paused/,
    );

    await expect(flyCoin.connect(Alice).unpause())
      .to.emit(flyCoin, 'Unpaused').withArgs(Alice.address);

    await expect(flyCoin.connect(Alice).mint(Caro.address, 1_000))
      .to.emit(flyCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Caro.address, 1_000);

    await expect(flyCoin.connect(Bob).transfer(Caro.address, 1_000))
      .to.emit(flyCoin, 'Transfer').withArgs(Bob.address, Caro.address, 1_000);

    await expect(flyCoin.connect(Caro).burn(100))
      .to.emit(flyCoin, 'Transfer').withArgs(Caro.address, ethers.constants.AddressZero, 100);

  });

  it('Upgradable', async () => {
    const { flyCoin, Alice, Bob, Caro, Dave } = await loadFixture(deployStakingPoolContractsFixture);

    // Bob: 10_000
    await expect(flyCoin.connect(Alice).mint(Bob.address, 10_000))
      .to.emit(flyCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Bob.address, 10_000);
    expect(await flyCoin.totalSupply()).to.equal(10_000);
    expect(await flyCoin.balanceOf(Bob.address)).to.equal(10_000);

    // Upgrade
    const TestFlyCoinV2 = await ethers.getContractFactory("TestFlyCoinV2");
    const flyCoinV2 = await upgrades.upgradeProxy(flyCoin.address, TestFlyCoinV2);

    expect(flyCoinV2.address).to.equal(flyCoin.address, 'Should keep same address after upgrade');

    // State should be kept
    expect(await flyCoinV2.totalSupply()).to.equal(10_000);
    expect(await flyCoinV2.balanceOf(Bob.address)).to.equal(10_000);

    await expect(flyCoinV2.connect(Alice).mint(Bob.address, 10_000))
      .to.emit(flyCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Bob.address, 10_000);

    await expect(flyCoinV2.connect(Alice).funcV2()).not.to.be.reverted;
  })

});