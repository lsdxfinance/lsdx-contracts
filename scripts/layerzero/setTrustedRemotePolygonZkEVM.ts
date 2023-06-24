import * as _ from 'lodash';
import dotenv from "dotenv";
import { ethers } from "hardhat";
import { ETHxOFTV2__factory } from '../../typechain';

dotenv.config();

const privateKey: string = process.env.PRIVATE_KEY || "";

// Polygon zkEVM testnet
const provider = new ethers.providers.JsonRpcProvider(`https://rpc.public.zkevm-test.net`);
const ethxOFTV2Address = '0x0839aF3391d05e28328E99Fe234023c2d22b3Fc2';
// ref: https://layerzero.gitbook.io/docs/technical-reference/testnet/testnet-addresses
const remoteChainId = 10121; // goerli
const remoteEthxAddress = '0x84DD87eB0fC034A098f7145a2f2d4C159359215A';

// Polygon zkEVM
// const provider = new ethers.providers.JsonRpcProvider(`https://zkevm-rpc.com`);

async function main() {
  const ethxOFTV2 = ETHxOFTV2__factory.connect(ethxOFTV2Address, provider);

  let remoteAndLocal = ethers.utils.solidityPack(
      ['address','address'],
      [remoteEthxAddress, ethxOFTV2Address]
  )

  let isTrustedRemote = await ethxOFTV2.isTrustedRemote(remoteChainId, remoteAndLocal);
  console.log(`Is trusted remote: ${isTrustedRemote}`);
  if (isTrustedRemote) {
    return;
  }

  const admin = new ethers.Wallet(privateKey, provider);
  const trans = await ethxOFTV2.connect(admin).setTrustedRemote(remoteChainId, remoteAndLocal);
  await trans.wait();
  console.log(`Set trusted remote`);
  isTrustedRemote = await ethxOFTV2.isTrustedRemote(remoteChainId, remoteAndLocal);
  console.log(`Is trusted remote: ${isTrustedRemote}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
