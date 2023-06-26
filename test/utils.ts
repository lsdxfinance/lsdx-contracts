import { BigNumber } from 'ethers';
import { expect } from 'chai'
import { ethers, upgrades } from 'hardhat';
import { time } from "@nomicfoundation/hardhat-network-helpers";
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
  EsLSD__factory,
  UniswapV2Factory__factory,
  UniswapV2Router02__factory,
  UniswapV2Pair__factory,
  StableSwapETHxPool__factory,
  BoostableFarm__factory,
  RewardBooster__factory,
  Votes__factory
} from '../typechain';

const { provider } = ethers;

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

export async function deployLsdxV2ContractsFixture() {
  const  [Alice, Bob, Caro, Dave]  = await ethers.getSigners();

  const LsdCoin = await ethers.getContractFactory('LsdCoin');
  const lsdCoinProxy = await upgrades.deployProxy(LsdCoin, []);
  const lsdCoin = LsdCoin__factory.connect(lsdCoinProxy.address, provider);

  const TestERC20 = await ethers.getContractFactory('TestERC20');
  const erc20Proxy = await upgrades.deployProxy(TestERC20, ['ETHx Token', 'ETHx']);
  const ethx = TestERC20__factory.connect(erc20Proxy.address, provider);

  const WETH9 = await ethers.getContractFactory('WETH9');
  const WETH9Contract = await WETH9.deploy();
  const weth = WETH9__factory.connect(WETH9Contract.address, provider);

  const StableSwapETHxPool = await ethers.getContractFactory('StableSwapETHxPool');
  const StableSwapETHxPoolContract = await StableSwapETHxPool.deploy();
  const ethxPool = StableSwapETHxPool__factory.connect(StableSwapETHxPoolContract.address, provider);

  const UniswapV2Factory = await ethers.getContractFactory('UniswapV2Factory');
  const UniswapV2FactoryContract = await UniswapV2Factory.deploy(ethers.constants.AddressZero);
  const uniswapV2Factory = UniswapV2Factory__factory.connect(UniswapV2FactoryContract.address, provider);
  const UniswapV2Router02 = await ethers.getContractFactory('UniswapV2Router02');
  const UniswapV2Router02Contract = await UniswapV2Router02.deploy(uniswapV2Factory.address, weth.address);
  const uniswapV2Router02 = UniswapV2Router02__factory.connect(UniswapV2Router02Contract.address, provider);
  const uniPairEthAmount = ethers.utils.parseEther('1');
  const uniPairLsdAmount = ethers.utils.parseUnits('1000000', 18);
  const uniPairDeadline = (await time.latest()) + ONE_DAY_IN_SECS;
  await expect(lsdCoin.connect(Alice).mint(Alice.address, uniPairLsdAmount)).not.to.be.reverted;
  await expect(lsdCoin.connect(Alice).approve(uniswapV2Router02.address, uniPairLsdAmount)).not.to.be.reverted;
  
  // Note: Update this value to the code hash used in test/UniswapV2Router02.sol:UniswapV2Library.pairFor()
  // const UniswapV2Pair = await ethers.getContractFactory('UniswapV2Pair');
  // console.log(ethers.utils.keccak256(UniswapV2Pair.bytecode));
  let trans = await uniswapV2Router02.connect(Alice).addLiquidityETH(lsdCoin.address, uniPairLsdAmount, uniPairLsdAmount, uniPairEthAmount, Alice.address, uniPairDeadline, {
    value: uniPairEthAmount
  });
  await trans.wait();
  const uniPairAddress = await uniswapV2Factory.getPair(lsdCoin.address, weth.address);
  const lsdEthPair = UniswapV2Pair__factory.connect(uniPairAddress, provider);

  const EsLSD = await ethers.getContractFactory('esLSD');
  const EsLSDContract = await EsLSD.deploy(lsdCoin.address, uniswapV2Router02.address, lsdEthPair.address);
  const esLSD = EsLSD__factory.connect(EsLSDContract.address, provider);

  const BoostableFarm = await ethers.getContractFactory('BoostableFarm');
  const BoostableFarmContract = await BoostableFarm.deploy(esLSD.address, ethx.address);
  const boostableFarm = BoostableFarm__factory.connect(BoostableFarmContract.address, provider);

  const RewardBooster = await ethers.getContractFactory('RewardBooster');
  const RewardBoosterContract = await RewardBooster.deploy(lsdEthPair.address, ethxPool.address, boostableFarm.address, esLSD.address);
  const rewardBooster = RewardBooster__factory.connect(RewardBoosterContract.address, provider);


  trans = await boostableFarm.connect(Alice).setRewardBooster(rewardBooster.address);
  await trans.wait();

  trans = await esLSD.connect(Alice).setRewardBooster(rewardBooster.address);
  await trans.wait();

  const Votes = await ethers.getContractFactory('Votes');
  const VotesContract = await Votes.deploy(esLSD.address);
  const votes = Votes__factory.connect(VotesContract.address, provider);

  return { lsdCoin, esLSD, weth, ethx, lsdEthPair, ethxPool, boostableFarm, rewardBooster, uniswapV2Router02, votes, Alice, Bob, Caro, Dave };
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