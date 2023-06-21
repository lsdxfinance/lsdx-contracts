import * as _ from 'lodash';
import dotenv from "dotenv";
import { ethers } from "hardhat";
import { ISLPDeposit__factory, ISLPCore__factory, IERC20__factory } from '../../typechain';
import { BigNumber } from 'ethers';

dotenv.config();
const privateKey: string = process.env.PRIVATE_KEY || "";
const infuraKey: string = process.env.INFURA_KEY || "";

// Goerli
// const slpDepositAddress = '0xE85E24C9E85a8e1DAF575DEEbFE2eccdB2a09122';
const slpCoreAddress = '0x92810f6023FA2485C3778fdd90985dC75660bb63';
const provider = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/${infuraKey}`);

async function main() {
  const admin = new ethers.Wallet(privateKey, provider);

  // const slpDeposit = ISLPDeposit__factory.connect(slpDepositAddress, provider);
  // const slpCoreAddress = await slpDeposit.slpCore();
  // console.log(`slpCore address: ${slpCoreAddress}`);

  const slpCore = ISLPCore__factory.connect(slpCoreAddress, provider);

  const veth2Address = await slpCore.vETH2();
  // const veth2Address = '0x6e2BA9C11ac4e6F3dFA1053c4f9dc1a3B7135c21';
  console.log(`vETH2 address: ${veth2Address}`);
  const veth2 = IERC20__factory.connect(veth2Address, provider);

  // check veth2 balance
  let veth2Balance = await veth2.balanceOf(admin.address);
  console.log(`vETH2 balance: ${ethers.utils.formatUnits(veth2Balance, 18)}`);
  
  // mint vETH2
  const veth2AmountToMint = ethers.utils.parseUnits('1', 18).div(10);
  const veth2MintTrans = await slpCore.connect(admin).mint({ value: veth2AmountToMint });
  await veth2MintTrans.wait();
  console.log(`Minted ${ethers.utils.formatUnits(veth2AmountToMint, 18)} vETH2`);

  veth2Balance = await veth2.balanceOf(admin.address);
  console.log(`vETH2 balance: ${ethers.utils.formatUnits(veth2Balance, 18)}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
