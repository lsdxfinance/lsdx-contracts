import * as _ from 'lodash';
import dotenv from "dotenv";
import { ethers } from "hardhat";
import { ICurveMetaPool__factory, IERC20__factory } from '../../typechain';

dotenv.config();
const privateKey: string = process.env.PRIVATE_KEY || "";
const infuraKey: string = process.env.INFURA_KEY || "";

// Goerli
const ethxAddress = '0xF4C911C395DB0b993AD2909c0135cbd4D31D89CA';
const stafiRETHAddress = '0xC118e5AeFd1de98a1d88498988D0d048dF11D66E';
const rethxPoolAddress = '0x930B9185b37A6dd051d74098A07da59D487C2963';
const provider = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/${infuraKey}`);

async function main() {
  const admin = new ethers.Wallet(privateKey, provider);

  const ethx = IERC20__factory.connect(ethxAddress, provider);
  const stafiRETH = IERC20__factory.connect(stafiRETHAddress, provider);
  const rethxPool = ICurveMetaPool__factory.connect(rethxPoolAddress, provider);

  const ethxAmountToAdd = ethers.utils.parseUnits('1', 18).div(100);
  const stafiRETHAmountToAdd = ethers.utils.parseUnits('1', 18).div(100);

  // Check balances
  const ethxBalance = await ethx.balanceOf(admin.address);
  if (ethxBalance.lt(ethxAmountToAdd)) {
    console.log(`Insufficient ETHx balance. Have ${ethers.utils.formatUnits(ethxBalance, 18)}, need ${ethers.utils.formatUnits(ethxAmountToAdd, 18)}`);
    return;
  }
  const stafiRETHBalance = await stafiRETH.balanceOf(admin.address);
  if (stafiRETHBalance.lt(stafiRETHAmountToAdd)) {
    console.log(`Insufficient stafiRETH balance. Have ${ethers.utils.formatUnits(stafiRETHBalance, 18)}, need ${ethers.utils.formatUnits(stafiRETHAmountToAdd, 18)}`);
    return;
  }

  // Approve
  const ethxApproveTrans = await ethx.connect(admin).approve(rethxPool.address, ethxAmountToAdd);
  await ethxApproveTrans.wait();
  console.log(`Approved ETHx transfer of ${ethers.utils.formatUnits(ethxAmountToAdd, 18)}`);
  const stafiRETHApproveTrans = await stafiRETH.connect(admin).approve(rethxPool.address, stafiRETHAmountToAdd);
  await stafiRETHApproveTrans.wait();
  console.log(`Approved stafiRETH transfer of ${ethers.utils.formatUnits(stafiRETHAmountToAdd, 18)}`);

  // Add liquidity
  const addLiqudiityTrans = await rethxPool.connect(admin).add_liquidity([ethxAmountToAdd, stafiRETHAmountToAdd], 0);
  await addLiqudiityTrans.wait();
  console.log(`Added liquidity of ${ethers.utils.formatUnits(ethxAmountToAdd, 18)} ETHx and ${ethers.utils.formatUnits(stafiRETHAmountToAdd, 18)} stafiRETH`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
