import { expect } from 'chai'
import { ethers, upgrades } from 'hardhat';
import { StakingPoolFactory__factory } from '../typechain/factories/contracts/StakingPoolFactory__factory';
import { TestERC20__factory } from '../typechain/factories/contracts/test/TestERC20__factory';
import { FlyCoin__factory } from '../typechain/factories/contracts/FlyCoin__factory';
import { BigNumber } from 'ethers';

const { provider, BigNumber } = ethers;

export const ONE_DAY_IN_SECS = 24 * 60 * 60;

export async function deployStakingPoolContractsFixture() {

  const FlyCoin = await ethers.getContractFactory('FlyCoin');
  const flyCoinProxy = await upgrades.deployProxy(FlyCoin, []);
  const flyCoin = FlyCoin__factory.connect(flyCoinProxy.address, provider);

  const StakingPoolFactory = await ethers.getContractFactory('StakingPoolFactory');
  const stakingPoolFactoryContract = await StakingPoolFactory.deploy(flyCoinProxy.address);
  const stakingPoolFactory = StakingPoolFactory__factory.connect(stakingPoolFactoryContract.address, provider);

  const TestERC20 = await ethers.getContractFactory('TestERC20');
  const wethProxy = await upgrades.deployProxy(TestERC20, ['Wrapped Ether', 'WETH']);
  const wETH = TestERC20__factory.connect(wethProxy.address, provider);
  const stETHProxy = await upgrades.deployProxy(TestERC20, ['Liquid staked Ether 2.0', 'stETH']);
  const stETH = TestERC20__factory.connect(stETHProxy.address, provider);
  const frxETHProxy = await upgrades.deployProxy(TestERC20, ['Frax Ether', 'frxETH']);
  const frxETH = TestERC20__factory.connect(frxETHProxy.address, provider);

  const  [Alice, Bob, Caro, Dave]  = await ethers.getSigners();

  return { flyCoin, stakingPoolFactory, wETH, stETH, frxETH, Alice, Bob, Caro, Dave };
}

export function expandTo18Decimals(n: number) {
  return BigNumber.from(n).mul(BigNumber.from(10).pow(18));
}

// ensure result is within .01%
export function expectBigNumberEquals(expected: BigNumber, actual: BigNumber) {
  expect(expected.sub(actual).abs().lte(expected.div(10000))).to.be.true;
}

// export async function mineBlock(provider: ethers.providers.Web3Provider, timestamp: number): Promise<void> {
//   return provider.send('evm_mine', [timestamp])
// }