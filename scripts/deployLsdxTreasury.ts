import * as _ from 'lodash';
import dotenv from "dotenv";
import { ethers } from "hardhat";
import { VeLSD__factory } from '../typechain/factories/contracts/treasury/VeLSD__factory';

dotenv.config();

const privateKey: string = process.env.PRIVATE_KEY || "";
const infuraKey: string = process.env.INFURA_KEY || "";

// // Goerli
// const provider = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/${infuraKey}`);
// const lsdCoinAddress = '0x6a45C5515CD20905e6A971A3185D82E8988aA826';
// const ethxAddress = '0xF4C911C395DB0b993AD2909c0135cbd4D31D89CA';

// // Mainnet
const provider = new ethers.providers.JsonRpcProvider(`https://mainnet.infura.io/v3/${infuraKey}`);
const lsdCoinAddress = '0xfAC77A24E52B463bA9857d6b758ba41aE20e31FF';
const ethxAddress = '0x21eAD867C8c5181854f6f8Ce71f75b173d2Bc16A';

async function main() {
  const VeLSD = await ethers.getContractFactory('veLSD');
  const veLSDContract = await VeLSD.deploy();
  const veLSD = VeLSD__factory.connect(veLSDContract.address, provider);
  console.log(`Deployed veLSD to: ${veLSD.address}`);

  const LsdxTreasury = await ethers.getContractFactory('LsdxTreasury');
  const LsdxTreasuryContract = await LsdxTreasury.deploy(lsdCoinAddress, [lsdCoinAddress, ethxAddress], veLSD.address);
  console.log(`Deployed LsdxTreasury to: ${LsdxTreasuryContract.address}`);

  const deployer = new ethers.Wallet(privateKey, provider);
  const trans = await veLSD.connect(deployer).setMinter(LsdxTreasuryContract.address);
  await trans.wait();
  console.log(`Set veLSD minter to LsdxTreasury`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
