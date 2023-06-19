import * as _ from 'lodash';
import dotenv from "dotenv";
import { ethers } from "hardhat";
import { ICurvePool__factory, IERC20__factory } from '../../typechain';
import { BigNumber } from 'ethers';

dotenv.config();
const privateKey: string = process.env.PRIVATE_KEY || "";
const infuraKey: string = process.env.INFURA_KEY || "";

// Goerli
const frxETHAddress = '0x6Bc98c23e1b72e5aA4b627f814c475071FF2dB47';
const ethxAddress = '0xF4C911C395DB0b993AD2909c0135cbd4D31D89CA';
const ethxPoolAddress = '0x3f1bE9EE10024EE5D3463eE0b407e56A1cC2E45E';
const provider = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/${infuraKey}`);

async function main() {
  const admin = new ethers.Wallet(privateKey, provider);

  const ethx = IERC20__factory.connect(ethxAddress, provider);
  const frxETH = IERC20__factory.connect(frxETHAddress, provider);
  const ethxPool = ICurvePool__factory.connect(ethxPoolAddress, provider);

  // Check ethx balances
  let ethxBalance = await ethx.balanceOf(admin.address);
  console.log(`ETHx balance: ${ethers.utils.formatUnits(ethxBalance, 18)}`);

  // Check frxETH balances
  const frxETHBalance = await frxETH.balanceOf(admin.address);
  console.log(`frxETH balance: ${ethers.utils.formatUnits(frxETHBalance, 18)}`);

  // Mint ETHx by adding 10 frxETH
  const frxETHAmountToAdd = ethers.utils.parseUnits('10', 18);
  const frxETHApproveTrans = await frxETH.connect(admin).approve(ethxPool.address, frxETHAmountToAdd);
  await frxETHApproveTrans.wait();
  console.log(`Approved frxETH transfer of ${ethers.utils.formatUnits(frxETHAmountToAdd, 18)}`);
  const addLiqudiityTrans = await ethxPool.connect(admin).add_liquidity([BigNumber.from(0), BigNumber.from(0), frxETHAmountToAdd, BigNumber.from(0)], BigNumber.from(0), { value: BigNumber.from(0) });
  await addLiqudiityTrans.wait();
  ethxBalance = await ethx.balanceOf(admin.address);
  console.log(`Added liquidity. ETHx balance: ${ethers.utils.formatUnits(ethxBalance, 18)}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
