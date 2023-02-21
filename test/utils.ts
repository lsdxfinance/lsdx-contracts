import { expect } from 'chai'
import { ethers, upgrades } from 'hardhat';
import { StakingPoolFactory__factory } from '../typechain/factories/contracts/StakingPoolFactory__factory';
import { WETH9__factory } from '../typechain/factories/contracts/test/WETH9__factory';
import { TestERC20__factory } from '../typechain/factories/contracts/test/TestERC20__factory';
import { FlyCoin__factory } from '../typechain/factories/contracts/FlyCoin__factory';

const { provider, BigNumber } = ethers;

export const ONE_DAY_IN_SECS = 24 * 60 * 60;

export const nativeTokenAddress = '0x0000000000000000000000000000000000000000';

export async function deployStakingPoolContractsFixture() {

  const FlyCoin = await ethers.getContractFactory('FlyCoin');
  const flyCoinProxy = await upgrades.deployProxy(FlyCoin, []);
  const flyCoin = FlyCoin__factory.connect(flyCoinProxy.address, provider);

  const WETH9 = await ethers.getContractFactory('WETH9');
  const WETH9Contract = await WETH9.deploy();
  const weth = WETH9__factory.connect(WETH9Contract.address, provider);

  const StakingPoolFactory = await ethers.getContractFactory('StakingPoolFactory');
  const stakingPoolFactoryContract = await StakingPoolFactory.deploy(flyCoinProxy.address, weth.address);
  const stakingPoolFactory = StakingPoolFactory__factory.connect(stakingPoolFactoryContract.address, provider);

  const TestERC20 = await ethers.getContractFactory('TestERC20');
  const erc20Proxy = await upgrades.deployProxy(TestERC20, ['Test ERC20', 'ERC20']);
  const erc20 = TestERC20__factory.connect(erc20Proxy.address, provider);

  const  [Alice, Bob, Caro, Dave]  = await ethers.getSigners();

  return { flyCoin, stakingPoolFactory, weth, erc20, Alice, Bob, Caro, Dave };
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