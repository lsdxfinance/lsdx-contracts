import _ from 'lodash';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployStakingPoolContractsFixture } from '../utils';

describe('veLSD', () => {

  it('Basic functionalities', async () => {

    const { veLSD, Alice, Bob } = await loadFixture(deployStakingPoolContractsFixture);

    // `Minter` could mint tokens
    await expect(veLSD.connect(Alice).mint(Alice.address, 10_000))
      .to.emit(veLSD, 'Transfer').withArgs(ethers.constants.AddressZero, Alice.address, 10_000);
    expect(await veLSD.totalSupply()).to.equal(10_000);
    expect(await veLSD.balanceOf(Alice.address)).to.equal(10_000);

    // Mintership could be transferred
    await expect(veLSD.connect(Bob).mint(Bob.address, 10_000)).to.be.rejectedWith(
      /Caller is not the minter/,
    );
    await expect(veLSD.connect(Alice).setMinter(Bob.address))
      .to.emit(veLSD, 'MintershipTransferred').withArgs(Alice.address, Bob.address);
    await expect(veLSD.connect(Alice).mint(Alice.address, 10_000)).to.be.rejectedWith(
      /Caller is not the minter/,
    );
    await expect(veLSD.connect(Bob).mint(Bob.address, 10_000))
      .to.emit(veLSD, 'Transfer').withArgs(ethers.constants.AddressZero, Bob.address, 10_000);
    expect(await veLSD.totalSupply()).to.equal(20_000);
    expect(await veLSD.balanceOf(Bob.address)).to.equal(10_000);

    // veLSD could not be transferred
    await expect(veLSD.connect(Alice).transfer(Bob.address, 1_000)).to.be.rejected;

    // `approve` is not disabled, but with no effect
    await expect(veLSD.connect(Alice).approve(Bob.address, 1_000))
      .to.emit(veLSD, 'Approval').withArgs(Alice.address, Bob.address, 1_000);
    await expect(veLSD.connect(Bob).transferFrom(Alice.address, Bob.address, 1_000)).to.be.rejected;

    // `Minter` could burn veLSD tokens
    await expect(veLSD.connect(Alice).burnFrom(Alice.address, 1_000)).to.be.rejected;
    await expect(veLSD.connect(Bob).burnFrom(Alice.address, 1_000))
      .to.emit(veLSD, 'Transfer').withArgs(Alice.address, ethers.constants.AddressZero, 1_000);
    expect(await veLSD.balanceOf(Alice.address)).to.equal(9_000);
  });

});