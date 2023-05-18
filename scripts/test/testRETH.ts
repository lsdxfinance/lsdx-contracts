import dotenv from "dotenv";
import { ethers } from "hardhat";
import { RETHToken__factory, StafiNetworkBalances__factory, StafiUserDeposit__factory  } from '../../typechain';

dotenv.config();

const privateKey: string = process.env.PRIVATE_KEY || "";
const infuraKey: string = process.env.INFURA_KEY || "";

const provider = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/${infuraKey}`);

async function main() {
  const admin = new ethers.Wallet(privateKey, provider);

  const rETH = RETHToken__factory.connect('0xC118e5AeFd1de98a1d88498988D0d048dF11D66E', provider);
  console.log(`rETH exchange rate: ${ethers.utils.formatUnits(await rETH.getExchangeRate(), 18)}`);

  const stafiUserDeposit = StafiUserDeposit__factory.connect('0xe9cb1226cdD73EE8723a3B51f66387a93F97F5EB', provider);
  const ethDepositAmount = ethers.utils.parseEther('0.1');
  let trans = await stafiUserDeposit.connect(admin).deposit({value: ethDepositAmount});
  await trans.wait();
  console.log(`Deposited 0.1 ETH to StafiUserDeposit`);

  const stafiNetworkBalances = StafiNetworkBalances__factory.connect('0x504432D6a4F49fE8446e79064ef4e4dD74e29aD2', provider);
  await stafiNetworkBalances.connect(admin).testSyncUserDeposits(ethDepositAmount, ethDepositAmount);
  console.log(`Synced user deposits`);

  const ethRewardsAmount = ethers.utils.parseEther('0.01');
  trans = await stafiNetworkBalances.connect(admin).testDepositEthRewards({value: ethRewardsAmount});
  await trans.wait();
  console.log(`Deposited eth rewards`);

  console.log(`rETH exchange rate: ${ethers.utils.formatUnits(await rETH.getExchangeRate(), 18)}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
