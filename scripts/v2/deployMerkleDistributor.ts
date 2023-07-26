import { ethers } from "hardhat";
import dotenv from "dotenv";
import { MerkleDistributorWithDeadline__factory } from '../../typechain';

dotenv.config();
const dayjs = require('dayjs');

// const privateKey: string = process.env.PRIVATE_KEY || "";
const infuraKey: string = process.env.INFURA_KEY || "";

const hexRoot = '0x5964a54af68a11ad8de41b1f99331a34b05e4560a77c8c78e932474fc64a3384';
const endTime = dayjs().add(30, 'day').unix();

// Goerli
// const provider = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/${infuraKey}`);
// const eslsdCoinAddress = '0x49dFb01E4268D4d4b5f47A2E1CCE664f68AbE586';

// mainnet
const provider = new ethers.providers.JsonRpcProvider(`https://mainnet.infura.io/v3/${infuraKey}`);
const eslsdCoinAddress = '0x081231339BcC4061e4511d73f1697C021B461aC2';

// const deployer = new ethers.Wallet(privateKey, provider);

async function main() {
  const MerkleDistributorWithDeadline = await ethers.getContractFactory('MerkleDistributorWithDeadline');
  const merkleDistributorContract = await MerkleDistributorWithDeadline.deploy(eslsdCoinAddress, hexRoot, endTime);
  const merkleDistributor = MerkleDistributorWithDeadline__factory.connect(merkleDistributorContract.address, provider);
  console.log(`Endtime: ${endTime}`);
  console.log(`Deployed MerkleDistributor to ${merkleDistributor.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
