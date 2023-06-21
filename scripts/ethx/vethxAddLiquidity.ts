import * as _ from 'lodash';
import dotenv from "dotenv";
import { ethers } from "hardhat";
import { ICurveMetaPool__factory, ISLPCore__factory, IERC20__factory } from '../../typechain';

dotenv.config();
const privateKey: string = process.env.PRIVATE_KEY || "";
const infuraKey: string = process.env.INFURA_KEY || "";

// Goerli
const ethxAddress = '0xF4C911C395DB0b993AD2909c0135cbd4D31D89CA';
const vETH2Address = '0x6e2BA9C11ac4e6F3dFA1053c4f9dc1a3B7135c21';
const vethxPoolAddress = '0x792e4dd07D115D45ac7cc2F47f48244ad4Ab1C60';
const provider = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/${infuraKey}`);

async function main() {
  const admin = new ethers.Wallet(privateKey, provider);

  const ethx = IERC20__factory.connect(ethxAddress, provider);
  const vETH2 = IERC20__factory.connect(vETH2Address, provider);
  const vethxPool = ICurveMetaPool__factory.connect(vethxPoolAddress, provider);

  const ethxAmountToAdd = ethers.utils.parseUnits('1', 18).div(1000);
  const vETH2AmountToAdd = ethers.utils.parseUnits('1', 18).div(1000);

  // Check balances
  const ethxBalance = await ethx.balanceOf(admin.address);
  if (ethxBalance.lt(ethxAmountToAdd)) {
    console.log(`Insufficient ETHx balance. Have ${ethers.utils.formatUnits(ethxBalance, 18)}, need ${ethers.utils.formatUnits(ethxAmountToAdd, 18)}`);
    return;
  }
  const vETH2Balance = await vETH2.balanceOf(admin.address);
  if (vETH2Balance.lt(vETH2AmountToAdd)) {
    console.log(`Insufficient vETH2 balance. Have ${ethers.utils.formatUnits(vETH2Balance, 18)}, need ${ethers.utils.formatUnits(vETH2AmountToAdd, 18)}`);
    return;
  }

  // Approve
  const ethxApproveTrans = await ethx.connect(admin).approve(vethxPool.address, ethxAmountToAdd);
  await ethxApproveTrans.wait();
  console.log(`Approved ETHx transfer of ${ethers.utils.formatUnits(ethxAmountToAdd, 18)}`);
  const vETH2ApproveTrans = await vETH2.connect(admin).approve(vethxPool.address, vETH2AmountToAdd);
  await vETH2ApproveTrans.wait();
  console.log(`Approved vETH2 transfer of ${ethers.utils.formatUnits(vETH2AmountToAdd, 18)}`);

  const slpCoreAddress = await vethxPool.slp_core();
  console.log(`slpCore address: ${slpCoreAddress}`);
  const slpCore = ISLPCore__factory.connect(slpCoreAddress, provider);
  const vETH2Price = await slpCore.calculateTokenAmount(ethers.utils.parseUnits('1', 18));
  console.log(`vETH2 price: ${ethers.utils.formatUnits(vETH2Price, 18)}`);

  // Add liquidity
  const addLiqudiityTrans = await vethxPool.connect(admin).add_liquidity([ethxAmountToAdd, vETH2AmountToAdd], 0);
  await addLiqudiityTrans.wait();
  console.log(`Added liquidity of ${ethers.utils.formatUnits(ethxAmountToAdd, 18)} ETHx and ${ethers.utils.formatUnits(vETH2AmountToAdd, 18)} vETH2`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
