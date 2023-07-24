import * as _ from 'lodash';
import dotenv from "dotenv";
import { ethers } from "hardhat";
import { Votes__factory } from '../../typechain';

dotenv.config();

const privateKey: string = process.env.PRIVATE_KEY || "";
const infuraKey: string = process.env.INFURA_KEY || "";

// // Goerli
// const provider = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/${infuraKey}`);
// const votesAddress = '0x3aa12934EE08eE98ED0A758782446cb30699E39B';
// const pools = [
//   {
//     name: 'LSD Pool',
//     bribeToken: '0x6a45C5515CD20905e6A971A3185D82E8988aA826',
//   },
//   {
//     name: 'ETHx Pool',
//     bribeToken: '0xE3AA29cC330c5dd28429641Dd50409553f1f4476',
//   },
// ];

// mainnet
const provider = new ethers.providers.JsonRpcProvider(`https://mainnet.infura.io/v3/${infuraKey}`);
const votesAddress = '0x2003d2Bc6C944ff0f8a16f79e6Bdc782a48BC1De';
const pools = [
  {
    name: 'vETH-ETHx',
    bribeToken: '0x1Fd097B75679a2896c007da75F4C74598A46bB7E',
  },
  {
    name: 'swETH-ETHx',
    bribeToken: '0x21eAD867C8c5181854f6f8Ce71f75b173d2Bc16A',
  },
];


async function main() {
  const votes = Votes__factory.connect(votesAddress, provider);

  const deployer = new ethers.Wallet(privateKey, provider);

  for (let i = 0; i < _.size(pools); i++) {
    const pool = pools[i];
    const trans = await votes.connect(deployer).addVotingPool(pool.name, pool.bribeToken);
    await trans.wait();
    console.log(`Added ${pool.name} with bribe token ${pool.bribeToken}`);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
