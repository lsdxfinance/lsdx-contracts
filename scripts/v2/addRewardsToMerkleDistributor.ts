import * as _ from 'lodash';
import dotenv from "dotenv";
import { ethers } from "hardhat";
import { LsdCoin__factory, EsLSD__factory, MerkleDistributorWithDeadline__factory } from '../../typechain';

const { BigNumber } = ethers;

dotenv.config();

const privateKey: string = process.env.PRIVATE_KEY || "";
const infuraKey: string = process.env.INFURA_KEY || "";

// Goerli
// const provider = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/${infuraKey}`);
// const lsdCoinAddress = '0x6a45C5515CD20905e6A971A3185D82E8988aA826';
// const eslsdCoinAddress = '0x49dFb01E4268D4d4b5f47A2E1CCE664f68AbE586';
// const merkleDistributorAddress = '0xAdf316b28E1Daacd51B90Ebf7cc3736d006CDa6f';

// mainnet
const provider = new ethers.providers.JsonRpcProvider(`https://mainnet.infura.io/v3/${infuraKey}`);
const lsdCoinAddress = '0xfAC77A24E52B463bA9857d6b758ba41aE20e31FF';
const eslsdCoinAddress = '0x081231339BcC4061e4511d73f1697C021B461aC2';
const merkleDistributorAddress = '0xdd92AC90B4234bd6C65D76812D1A5043cD617737';

function expandTo18Decimals(n: number) {
  return BigNumber.from(n).mul(BigNumber.from(10).pow(18));
}

async function main() {
  const lsdToken = LsdCoin__factory.connect(lsdCoinAddress, provider);
  const eslsdToken = EsLSD__factory.connect(eslsdCoinAddress, provider);
  const merkleDistributor = MerkleDistributorWithDeadline__factory.connect(merkleDistributorAddress, provider);

  const admin = new ethers.Wallet(privateKey, provider);

  let totalRewards = expandTo18Decimals(2404926);
  console.log(`Adding airdrop rewards ${ethers.utils.formatUnits(totalRewards, 18)}`);

  // Convert total rewards to eSLSD
  console.log(`Converting $LSD to $esLSD`);
  let trans = await lsdToken.connect(admin).approve(eslsdToken.address, totalRewards);
  await trans.wait();
  console.log(`Approved $esLSD to spend $LSD`);
  trans = await eslsdToken.connect(admin).escrow(totalRewards);
  await trans.wait();
  console.log(`Escrowed $LSD to esLSD`);

  trans = await eslsdToken.connect(admin).transfer(merkleDistributor.address, totalRewards);
  await trans.wait();
  console.log(`Transferred ${ethers.utils.formatUnits(totalRewards, 18)} esLSD to merkle distributor`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
