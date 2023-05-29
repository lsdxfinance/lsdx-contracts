import { expect } from 'chai'
import { ethers, upgrades } from 'hardhat';
import { 
  StakingPoolFactory__factory,
  WETH9__factory,
  TestERC20__factory,
  StETH__factory,
  FrxETH__factory,
  SfrxETH__factory,
  LsdCoin__factory,
  PlainStakingPool__factory,
  FraxStakingPool__factory,
  VeLSD__factory,
  LsdxFarmFactory__factory,
  EsLSD__factory
} from '../typechain';

const { provider, BigNumber } = ethers;

export const ONE_DAY_IN_SECS = 24 * 60 * 60;

export const nativeTokenAddress = '0x0000000000000000000000000000000000000000';

export async function deployLsdxContractsFixture() {
  const  [Alice, Bob, Caro, Dave]  = await ethers.getSigners();

  const LsdCoin = await ethers.getContractFactory('LsdCoin');
  const lsdCoinProxy = await upgrades.deployProxy(LsdCoin, []);
  const lsdCoin = LsdCoin__factory.connect(lsdCoinProxy.address, provider);

  const WETH9 = await ethers.getContractFactory('WETH9');
  const WETH9Contract = await WETH9.deploy();
  const weth = WETH9__factory.connect(WETH9Contract.address, provider);

  const StETH = await ethers.getContractFactory('StETH');
  const StETHContract = await StETH.deploy();
  const stETH = StETH__factory.connect(StETHContract.address, provider);

  const FrxETH = await ethers.getContractFactory('frxETH');
  const FrxETHContract = await FrxETH.deploy(Alice.address, Alice.address);
  const frxETH = FrxETH__factory.connect(FrxETHContract.address, provider);

  const SfrxETH = await ethers.getContractFactory('sfrxETH');
  const SfrxETHContract = await SfrxETH.deploy(frxETH.address, 604800); // 7 days
  const sfrxETH = SfrxETH__factory.connect(SfrxETHContract.address, provider);

  const StakingPoolFactory = await ethers.getContractFactory('StakingPoolFactory');
  const stakingPoolFactoryContract = await StakingPoolFactory.deploy(lsdCoinProxy.address, weth.address);
  const stakingPoolFactory = StakingPoolFactory__factory.connect(stakingPoolFactoryContract.address, provider);

  const LsdxFarmFactory = await ethers.getContractFactory('LsdxFarmFactory');
  const LsdxFarmFactoryContract = await LsdxFarmFactory.deploy(lsdCoinProxy.address);
  const lsdxFarmFactory = LsdxFarmFactory__factory.connect(LsdxFarmFactoryContract.address, provider);

  const TestERC20 = await ethers.getContractFactory('TestERC20');
  const erc20Proxy = await upgrades.deployProxy(TestERC20, ['Test ERC20', 'ERC20']);
  const erc20 = TestERC20__factory.connect(erc20Proxy.address, provider);

  const PlainStakingPool = await ethers.getContractFactory('PlainStakingPool');
  const PlainStakingPoolContract = await PlainStakingPool.deploy(lsdCoin.address, erc20.address, 7);
  const v2PlainStakingPool = PlainStakingPool__factory.connect(PlainStakingPoolContract.address, provider);

  const FraxStakingPool = await ethers.getContractFactory('FraxStakingPool');
  const FraxStakingPoolContract = await FraxStakingPool.deploy(sfrxETH.address, lsdCoin.address, frxETH.address, 7);
  const v2FraxStakingPool = FraxStakingPool__factory.connect(FraxStakingPoolContract.address, provider);

  const VeLSD = await ethers.getContractFactory('veLSD');
  const veLSDContract = await VeLSD.deploy();
  const veLSD = VeLSD__factory.connect(veLSDContract.address, provider);

  const EsLSD = await ethers.getContractFactory('esLSD');
  const EsLSDContract = await EsLSD.deploy(lsdCoin.address);
  const esLSD = EsLSD__factory.connect(EsLSDContract.address, provider);

  return { lsdCoin, stakingPoolFactory, lsdxFarmFactory, v2PlainStakingPool, v2FraxStakingPool, weth, stETH, frxETH, sfrxETH, erc20, veLSD, esLSD, Alice, Bob, Caro, Dave };
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