import dotenv from "dotenv";
import { ethers } from "hardhat";
import { FrxETH__factory } from '../../typechain/factories/contracts/test/frxETH.sol/FrxETH__factory';
import { SfrxETH__factory } from '../../typechain/factories/contracts/test/sfrxETH.sol/SfrxETH__factory';

dotenv.config();

const privateKey: string = process.env.PRIVATE_KEY || "";
const infuraKey: string = process.env.INFURA_KEY || "";

const provider = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/${infuraKey}`);

async function main() {
  const deployer = new ethers.Wallet(privateKey, provider);

  const FrxETH = await ethers.getContractFactory('frxETH');
  const FrxETHContract = await FrxETH.connect(deployer).deploy(deployer.address, deployer.address);
  await FrxETHContract.deployed();
  const frxETH = FrxETH__factory.connect(FrxETHContract.address, provider);
  console.log(`Deployed frxETH to ${frxETH.address}`);

  const SfrxETH = await ethers.getContractFactory('sfrxETH');
  const SfrxETHContract = await SfrxETH.connect(deployer).deploy(frxETH.address, 86400); // 1 day
  await SfrxETHContract.deployed();
  const sfrxETH = SfrxETH__factory.connect(SfrxETHContract.address, provider);
  console.log(`Deployed sfrxETH to ${sfrxETH.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
