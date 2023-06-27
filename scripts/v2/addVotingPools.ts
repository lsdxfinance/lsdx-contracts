import * as _ from 'lodash';
import dotenv from "dotenv";
import { ethers } from "hardhat";
import { Votes__factory } from '../../typechain';

dotenv.config();

const privateKey: string = process.env.PRIVATE_KEY || "";
const infuraKey: string = process.env.INFURA_KEY || "";

// Goerli
const provider = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/${infuraKey}`);
const votesAddress = '0xCb68A7A7558f46aBb20BA1BE7C5abd429E9fFAe6';
const pools = [
  {
    name: 'LSD Pool',
    bribeToken: '0x6a45C5515CD20905e6A971A3185D82E8988aA826',
  },
  {
    name: 'ETHx Pool',
    bribeToken: '0xE3AA29cC330c5dd28429641Dd50409553f1f4476',
  },
];

// mainnet
// const provider = new ethers.providers.JsonRpcProvider(`https://mainnet.infura.io/v3/${infuraKey}`);


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
