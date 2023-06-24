import * as _ from 'lodash';
import dotenv from "dotenv";
import { ethers } from "hardhat";
import { ETHxProxyOFTV2__factory } from '../../typechain';

dotenv.config();

const privateKey: string = process.env.PRIVATE_KEY || "";
const infuraKey: string = process.env.INFURA_KEY || "";

// Goerli
const provider = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/${infuraKey}`);
const ethxAddress = '0xE3AA29cC330c5dd28429641Dd50409553f1f4476';
const ethxProxyOFTV2Address = '0x84DD87eB0fC034A098f7145a2f2d4C159359215A';
// ref: https://layerzero.gitbook.io/docs/technical-reference/testnet/testnet-addresses
const remoteChainId = 10158; // zksync-testnet
const remoteEthxAddress = '0x0839aF3391d05e28328E99Fe234023c2d22b3Fc2';

// mainnet
// const provider = new ethers.providers.JsonRpcProvider(`https://mainnet.infura.io/v3/${infuraKey}`);
// const ethxAddress = '';
// const ethxProxyOFTV2Address = '';

async function main() {
  const ethxProxy = ETHxProxyOFTV2__factory.connect(ethxProxyOFTV2Address, provider);

  let remoteAndLocal = ethers.utils.solidityPack(
      ['address','address'],
      [remoteEthxAddress, ethxAddress]
  )

  let isTrustedRemote = await ethxProxy.isTrustedRemote(remoteChainId, remoteAndLocal);
  console.log(`Is trusted remote: ${isTrustedRemote}`);
  if (isTrustedRemote) {
    return;
  }

  const admin = new ethers.Wallet(privateKey, provider);
  const trans = await ethxProxy.connect(admin).setTrustedRemote(remoteChainId, remoteAndLocal);
  await trans.wait();
  console.log(`Set trusted remote`);
  isTrustedRemote = await ethxProxy.isTrustedRemote(remoteChainId, remoteAndLocal);
  console.log(`Is trusted remote: ${isTrustedRemote}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
