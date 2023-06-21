import * as _ from 'lodash';
import dotenv from "dotenv";
import { ethers } from "hardhat";
import { ICurveMetaPool__factory, IERC20__factory } from '../../typechain';

dotenv.config();
const privateKey: string = process.env.PRIVATE_KEY || "";
const infuraKey: string = process.env.INFURA_KEY || "";

// Goerli
const ethxAddress = '0xF4C911C395DB0b993AD2909c0135cbd4D31D89CA';
const swETHAddress = '0x8bb383A752Ff3c1d510625C6F536E3332327068F';
const swethxPoolAddress = '0x16a097f539942d48F6e10bbE1903735d2305d5D9';
const provider = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/${infuraKey}`);

async function main() {
  const admin = new ethers.Wallet(privateKey, provider);

  const ethx = IERC20__factory.connect(ethxAddress, provider);
  const swETH = IERC20__factory.connect(swETHAddress, provider);
  const swethxPool = ICurveMetaPool__factory.connect(swethxPoolAddress, provider);

  const ethxAmountToAdd = ethers.utils.parseUnits('1', 18).div(1000);
  const swETHAmountToAdd = ethers.utils.parseUnits('1', 18).div(1000);

  // Check balances
  const ethxBalance = await ethx.balanceOf(admin.address);
  if (ethxBalance.lt(ethxAmountToAdd)) {
    console.log(`Insufficient ETHx balance. Have ${ethers.utils.formatUnits(ethxBalance, 18)}, need ${ethers.utils.formatUnits(ethxAmountToAdd, 18)}`);
    return;
  }
  const swETHBalance = await swETH.balanceOf(admin.address);
  if (swETHBalance.lt(swETHAmountToAdd)) {
    console.log(`Insufficient swETH balance. Have ${ethers.utils.formatUnits(swETHBalance, 18)}, need ${ethers.utils.formatUnits(swETHAmountToAdd, 18)}`);
    return;
  }

  // Approve
  const ethxApproveTrans = await ethx.connect(admin).approve(swethxPool.address, ethxAmountToAdd);
  await ethxApproveTrans.wait();
  console.log(`Approved ETHx transfer of ${ethers.utils.formatUnits(ethxAmountToAdd, 18)}`);
  const swETHApproveTrans = await swETH.connect(admin).approve(swethxPool.address, swETHAmountToAdd);
  await swETHApproveTrans.wait();
  console.log(`Approved swETH transfer of ${ethers.utils.formatUnits(swETHAmountToAdd, 18)}`);

  // Add liquidity
  const addLiqudiityTrans = await swethxPool.connect(admin).add_liquidity([ethxAmountToAdd, swETHAmountToAdd], 0);
  await addLiqudiityTrans.wait();
  console.log(`Added liquidity of ${ethers.utils.formatUnits(ethxAmountToAdd, 18)} ETHx and ${ethers.utils.formatUnits(swETHAmountToAdd, 18)} swETH`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
