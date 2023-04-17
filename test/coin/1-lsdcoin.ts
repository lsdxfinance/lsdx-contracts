import _ from 'lodash';
import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployLsdxContractsFixture } from '../utils';

describe('LsdCoin', () => {

  it('Mintable, transferable and burnable', async () => {

    const { lsdCoin, Alice, Bob, Caro, Dave } = await loadFixture(deployLsdxContractsFixture);

    // Bob: 10_000
    await expect(lsdCoin.connect(Alice).mint(Bob.address, 10_000))
      .to.emit(lsdCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Bob.address, 10_000);
    expect(await lsdCoin.totalSupply()).to.equal(10_000);
    expect(await lsdCoin.balanceOf(Bob.address)).to.equal(10_000);

    // Bob: 10_000, Caro: 1_000
    await expect(lsdCoin.connect(Alice).mint(Caro.address, 1_000))
      .to.emit(lsdCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Caro.address, 1_000);
    expect(await lsdCoin.totalSupply()).to.equal(10_000 + 1_000);
    expect(await lsdCoin.balanceOf(Caro.address)).to.equal(1_000);

    // Bob: 10_000, Caro: 900, Dave: 100
    await expect(lsdCoin.connect(Caro).transfer(Dave.address, 100))
      .to.emit(lsdCoin, 'Transfer').withArgs(Caro.address, Dave.address, 100);
    expect(await lsdCoin.balanceOf(Caro.address)).to.equal(900);
    expect(await lsdCoin.balanceOf(Dave.address)).to.equal(100);

    // Bob: 10_000, Caro: 800, Dave: 100
    await expect(lsdCoin.connect(Caro).burn(100))
      .to.emit(lsdCoin, 'Transfer').withArgs(Caro.address, ethers.constants.AddressZero, 100);
    expect(await lsdCoin.balanceOf(Caro.address)).to.equal(800);

    // Bob: 10_000, Caro: 700, Dave: 200
    await expect(lsdCoin.connect(Caro).approve(Dave.address, 100))
      .to.emit(lsdCoin, 'Approval').withArgs(Caro.address, Dave.address, 100);
    await expect(lsdCoin.connect(Dave).transferFrom(Caro.address, Dave.address, 100))
      .to.emit(lsdCoin, 'Transfer').withArgs(Caro.address, Dave.address, 100);
    expect(await lsdCoin.balanceOf(Caro.address)).to.equal(700);
    expect(await lsdCoin.balanceOf(Dave.address)).to.equal(200);

  });

  it('Access control', async () => {

    const { lsdCoin, Alice, Bob } = await loadFixture(deployLsdxContractsFixture);

    await expect(lsdCoin.connect(Bob).mint(Bob.address, 10_000)).to.be.rejectedWith(
      /AccessControl/,
    );

    const minterRole = await lsdCoin.MINTER_ROLE();
    await expect(lsdCoin.connect(Alice).grantRole(minterRole, Bob.address))
      .to.emit(lsdCoin, 'RoleGranted').withArgs(minterRole, Bob.address, Alice.address);

    await expect(lsdCoin.connect(Bob).mint(Bob.address, 10_000))
      .to.emit(lsdCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Bob.address, 10_000);

    await expect(lsdCoin.connect(Alice).revokeRole(minterRole, Bob.address))
      .to.emit(lsdCoin, 'RoleRevoked').withArgs(minterRole, Bob.address, Alice.address);
  
    await expect(lsdCoin.connect(Bob).mint(Bob.address, 10_000)).to.be.rejectedWith(
      /AccessControl/,
    );

    // Alice could grant DEFAULT_ADMIN_ROLE to Bob
    const defaultAdminRole = await lsdCoin.DEFAULT_ADMIN_ROLE();
    await expect(lsdCoin.connect(Alice).grantRole(defaultAdminRole, Bob.address))
      .to.emit(lsdCoin, 'RoleGranted').withArgs(defaultAdminRole, Bob.address, Alice.address);
    
    // Alice reounce all roles including DEFAULT_ADMIN_ROLE
    const pauserRole = await lsdCoin.PAUSER_ROLE();
    const upgradeRole = await lsdCoin.UPGRADER_ROLE();
    await expect(lsdCoin.connect(Alice).renounceRole(defaultAdminRole, Alice.address))
      .to.emit(lsdCoin, 'RoleRevoked').withArgs(defaultAdminRole, Alice.address, Alice.address);
    await expect(lsdCoin.connect(Alice).renounceRole(minterRole, Alice.address))
      .to.emit(lsdCoin, 'RoleRevoked').withArgs(minterRole, Alice.address, Alice.address);
    await expect(lsdCoin.connect(Alice).renounceRole(pauserRole, Alice.address))
      .to.emit(lsdCoin, 'RoleRevoked').withArgs(pauserRole, Alice.address, Alice.address);
    await expect(lsdCoin.connect(Alice).renounceRole(upgradeRole, Alice.address))
      .to.emit(lsdCoin, 'RoleRevoked').withArgs(upgradeRole, Alice.address, Alice.address);
    
    // Now Alice could NOT grant roles
    await expect(lsdCoin.connect(Alice).grantRole(minterRole, Alice.address)).to.be.rejectedWith(
      /AccessControl/,
    );
    
    // With DEFAULT_ADMIN_ROLE, Bob could grant roles
    await expect(lsdCoin.connect(Bob).grantRole(minterRole, Bob.address))
      .to.emit(lsdCoin, 'RoleGranted').withArgs(minterRole, Bob.address, Bob.address);
  });

  it('Pausable', async () => {

    const { lsdCoin, Alice, Bob, Caro } = await loadFixture(deployLsdxContractsFixture);

    await expect(lsdCoin.connect(Alice).mint(Bob.address, 10_000))
      .to.emit(lsdCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Bob.address, 10_000);

    await expect(lsdCoin.connect(Alice).mint(Caro.address, 1_000))
      .to.emit(lsdCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Caro.address, 1_000);

    await expect(lsdCoin.connect(Bob).transfer(Caro.address, 1_000))
      .to.emit(lsdCoin, 'Transfer').withArgs(Bob.address, Caro.address, 1_000);

    await expect(lsdCoin.connect(Alice).pause())
      .to.emit(lsdCoin, 'Paused').withArgs(Alice.address);

    await expect(lsdCoin.connect(Alice).mint(Caro.address, 1_000)).to.be.rejectedWith(
      /Pausable: paused/,
    );

    await expect(lsdCoin.connect(Bob).transfer(Caro.address, 1_000)).to.be.rejectedWith(
      /Pausable: paused/,
    );

    await expect(lsdCoin.connect(Bob).burn(100)).to.be.rejectedWith(
      /Pausable: paused/,
    );

    await expect(lsdCoin.connect(Alice).unpause())
      .to.emit(lsdCoin, 'Unpaused').withArgs(Alice.address);

    await expect(lsdCoin.connect(Alice).mint(Caro.address, 1_000))
      .to.emit(lsdCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Caro.address, 1_000);

    await expect(lsdCoin.connect(Bob).transfer(Caro.address, 1_000))
      .to.emit(lsdCoin, 'Transfer').withArgs(Bob.address, Caro.address, 1_000);

    await expect(lsdCoin.connect(Caro).burn(100))
      .to.emit(lsdCoin, 'Transfer').withArgs(Caro.address, ethers.constants.AddressZero, 100);

  });

  it('Upgradable', async () => {
    const { lsdCoin, Alice, Bob, Caro, Dave } = await loadFixture(deployLsdxContractsFixture);

    // Bob: 10_000
    await expect(lsdCoin.connect(Alice).mint(Bob.address, 10_000))
      .to.emit(lsdCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Bob.address, 10_000);
    expect(await lsdCoin.totalSupply()).to.equal(10_000);
    expect(await lsdCoin.balanceOf(Bob.address)).to.equal(10_000);

    // Upgrade
    const TestLsdCoinV2 = await ethers.getContractFactory("TestLsdCoinV2");
    const lsdCoinV2 = await upgrades.upgradeProxy(lsdCoin.address, TestLsdCoinV2);

    expect(lsdCoinV2.address).to.equal(lsdCoin.address, 'Should keep same address after upgrade');

    // State should be kept
    expect(await lsdCoinV2.totalSupply()).to.equal(10_000);
    expect(await lsdCoinV2.balanceOf(Bob.address)).to.equal(10_000);

    await expect(lsdCoinV2.connect(Alice).mint(Bob.address, 10_000))
      .to.emit(lsdCoin, 'Transfer').withArgs(ethers.constants.AddressZero, Bob.address, 10_000);

    await expect(lsdCoinV2.connect(Alice).funcV2()).not.to.be.reverted;
  })

});