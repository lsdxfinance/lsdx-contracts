import { ethers, upgrades } from 'hardhat';
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { StakingPoolFactory__factory } from '../typechain/factories/contracts/StakingPoolFactory__factory';
import { TestERC20__factory } from '../typechain/factories/contracts/test/TestERC20__factory';
import { FlyCoin__factory } from '../typechain/factories/contracts/FlyCoin__factory';

const { provider } = ethers;

export const nativeTokenAddress = '0x0000000000000000000000000000000000000000';

export const ONE_DAY_IN_SECS = 24 * 60 * 60;

export async function deployContractsFixture() {

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