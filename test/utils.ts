import { expect } from 'chai'
import { ethers, upgrades } from 'hardhat';
import { StakingPoolFactory__factory } from '../typechain/factories/contracts/StakingPoolFactory__factory';
import { WETH9__factory } from '../typechain/factories/contracts/test/WETH9__factory';
import { TestERC20__factory } from '../typechain/factories/contracts/test/TestERC20__factory';
import { StETH__factory } from '../typechain/factories/contracts/test/StETH__factory';
import { LsdCoin__factory } from '../typechain/factories/contracts/LsdCoin__factory';

const { provider, BigNumber } = ethers;

export const ONE_DAY_IN_SECS = 24 * 60 * 60;

export const nativeTokenAddress = '0x0000000000000000000000000000000000000000';

export async function deployStakingPoolContractsFixture() {

  const LsdCoin = await ethers.getContractFactory('LsdCoin');
  const lsdCoinProxy = await upgrades.deployProxy(LsdCoin, []);
  const lsdCoin = LsdCoin__factory.connect(lsdCoinProxy.address, provider);

  const WETH9 = await ethers.getContractFactory('WETH9');
  const WETH9Contract = await WETH9.deploy();
  const weth = WETH9__factory.connect(WETH9Contract.address, provider);

  const StETH = await ethers.getContractFactory('StETH');
  const StETHContract = await StETH.deploy();
  const stETH = StETH__factory.connect(StETHContract.address, provider);

  const StakingPoolFactory = await ethers.getContractFactory('StakingPoolFactory');
  const stakingPoolFactoryContract = await StakingPoolFactory.deploy(lsdCoinProxy.address, weth.address);
  const stakingPoolFactory = StakingPoolFactory__factory.connect(stakingPoolFactoryContract.address, provider);

  const TestERC20 = await ethers.getContractFactory('TestERC20');
  const erc20Proxy = await upgrades.deployProxy(TestERC20, ['Test ERC20', 'ERC20']);
  const erc20 = TestERC20__factory.connect(erc20Proxy.address, provider);

  const  [Alice, Bob, Caro, Dave]  = await ethers.getSigners();

  return { lsdCoin, stakingPoolFactory, weth, stETH, erc20, Alice, Bob, Caro, Dave };
}

export function expandTo18Decimals(n: number) {
  return BigNumber.from(n).mul(BigNumber.from(10).pow(18));
}

// ensure result is within .01%
export function expectBigNumberEquals(expected: BigNumber, actual: BigNumber) {
  const equals = expected.sub(actual).abs().lte(expected.div(10000));
  if (!equals) {
    console.log(`BigNumber does not equal. expected: ${expected.toString()}, actual: ${actual.toString()}`);
  }
  expect(equals).to.be.true;
}