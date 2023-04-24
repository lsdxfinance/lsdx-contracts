import * as _ from 'lodash';
import dotenv from "dotenv";
import { ethers } from "hardhat";
import { StakingPool__factory, IETHxPool__factory } from '../typechain';
import { IERC20__factory } from '../typechain/factories/@openzeppelin/contracts/token/ERC20';

dotenv.config();
const infuraKey: string = process.env.INFURA_KEY || "";
const provider = new ethers.providers.JsonRpcProvider(`https://mainnet.infura.io/v3/${infuraKey}`);

const stETHAddress = '0xae7ab96520de3a18e5e111b5eaab095312d7fe84';
const stETHStakingPoolAddress = '0x5937f58c2BE65E95b5519f126a79a4CA4F281f10';
const ethxPoolAddress = '0x7b0Eff0C991F0AA880481FdFa5624Cb0BC9b10e1';

async function main() {
  const stETH = IERC20__factory.connect(stETHAddress, provider);
  const stETHStakingPool = StakingPool__factory.connect(stETHStakingPoolAddress, provider);

  const stETHFees = (await stETH.balanceOf(stETHStakingPoolAddress)).sub(await stETHStakingPool.totalSupply());
  console.log(`stETH fees: ${ethers.utils.formatEther(stETHFees)}`);

  const ethxPool = IETHxPool__factory.connect(ethxPoolAddress, provider);
  console.log(`ETHx fees`);
  console.log(`\tETH: ${ethers.utils.formatEther(await ethxPool.admin_balances(0))}`);
  console.log(`\tstETH: ${ethers.utils.formatUnits(await ethxPool.admin_balances(1), 18)}`);
  console.log(`\tfrxETH: ${ethers.utils.formatUnits(await ethxPool.admin_balances(2), 18)}`);
  console.log(`\trETH: ${ethers.utils.formatUnits(await ethxPool.admin_balances(3), 18)}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
