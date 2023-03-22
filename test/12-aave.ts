import _ from 'lodash';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployStakingPoolContractsFixture, expandTo18Decimals } from './utils';
import { Pool__factory } from '../typechain/factories/contracts/test/AToken.sol/Pool__factory';
import { AToken__factory } from '../typechain/factories/contracts/test/AToken.sol/AToken__factory';

const { provider } = ethers;

describe('aave', () => {

  it('aave works', async () => {
    const { erc20, Alice, Bob } = await loadFixture(deployStakingPoolContractsFixture);

    const Pool = await ethers.getContractFactory('Pool');
    const PoolContract = await Pool.deploy();
    const pool = Pool__factory.connect(PoolContract.address, provider);

    const AToken = await ethers.getContractFactory('AToken');
    const ATokenContract = await upgrades.deployProxy(AToken, ['AAVE ERC20', 'aERC20']);
    const atoken = AToken__factory.connect(ATokenContract.address, provider);

    await pool.connect(Alice).addAToken(erc20.address, atoken.address);

    const aliceBobAssetAmount = expandTo18Decimals(10);
    await expect(erc20.connect(Alice).mint(Alice.address, aliceBobAssetAmount)).not.to.be.reverted;
    await expect(erc20.connect(Alice).mint(Bob.address, aliceBobAssetAmount)).not.to.be.reverted;

    await expect(erc20.connect(Alice).approve(pool.address, aliceBobAssetAmount)).not.to.be.reverted;
    await expect(pool.connect(Alice).supply(erc20.address, aliceBobAssetAmount, Alice.address, 0)).not.to.be.reverted;

    expect(await erc20.balanceOf(pool.address)).to.equal(aliceBobAssetAmount);
    expect(await atoken.balanceOf(Alice.address)).to.equal(aliceBobAssetAmount);

    // await expect(atoken.connect(Alice).mint(Alice.address, expandTo18Decimals(10))).not.to.be.reverted;
    // expect(await atoken.balanceOf(Alice.address)).to.equal(expandTo18Decimals(20));

    await expect(pool.connect(Alice).withdraw(erc20.address, aliceBobAssetAmount, Alice.address)).not.to.be.reverted;

    expect(await erc20.balanceOf(pool.address)).to.equal(0);
    expect(await erc20.balanceOf(Alice.address)).to.equal(aliceBobAssetAmount);
    expect(await atoken.balanceOf(Alice.address)).to.equal(0);
  });

});