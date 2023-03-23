import { ethers } from "hardhat";

// // Goerli
const lsdCoinAddress = '0x6a45C5515CD20905e6A971A3185D82E8988aA826';
const wethAddress = '0xCCB14936C2E000ED8393A571D15A2672537838Ad';
const aavePoolAddress = '0x7b5C526B7F8dfdff278b4a3e045083FBA4028790';

// mainnet
// const lsdCoinAddress = '0xfAC77A24E52B463bA9857d6b758ba41aE20e31FF';
// const wethAddress = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
// const aavePoolAddress = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2';

async function deployAaveREthPool() {
  const rETH = '0xae78736cd615f374d3085123a210448e74fc6393';
  const aEthrETH = '0xcc9ee9483f662091a1de4795249e24ac0ac2630f';

  const AaveStakingPool = await ethers.getContractFactory('AaveStakingPool');
  const contract = await AaveStakingPool.deploy(aavePoolAddress, aEthrETH, lsdCoinAddress, rETH, 7);
  console.log(`Deployed AaveStakingPool for rETH to ${contract.address}`);
}

async function deployAaveEthPool() {
  const aEthWETH = '0x7649e0d153752c556b8b23DB1f1D3d42993E83a5';

  const AaveEthStakingPool = await ethers.getContractFactory('AaveEthStakingPool');
  const contract = await AaveEthStakingPool.deploy(aavePoolAddress, aEthWETH, lsdCoinAddress, wethAddress, 7);
  console.log(`Deployed AaveEthStakingPool to ${contract.address}`);
}

async function deployFrxEthPool() {
  const frxETH = '0x5E8422345238F34275888049021821E8E08CAa1f';
  const sfrxETH = '0xac3E018457B222d93114458476f3E3416Abbe38F';

  const FraxStakingPool = await ethers.getContractFactory('FraxStakingPool');
  const contract = await FraxStakingPool.deploy(sfrxETH, lsdCoinAddress, frxETH, 7);
  console.log(`Deployed FraxStakingPool to ${contract.address}`);
}


async function main() {
  // await deployAaveREthPool();
  await deployAaveEthPool();
  // await deployFrxEthPool();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
