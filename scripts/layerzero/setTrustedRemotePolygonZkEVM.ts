import * as _ from 'lodash';
import dotenv from "dotenv";
import { ethers } from "hardhat";
import { ETHxOFT__factory } from '../../typechain';

dotenv.config();

const privateKey: string = process.env.PRIVATE_KEY || "";

// Polygon zkEVM testnet
const provider = new ethers.providers.JsonRpcProvider(`https://rpc.public.zkevm-test.net`);
const ethxOFTAddress = '0xb16b9F9CaA3fdAD503eD35E1d7C773f2BE79E0B1';
// ref: https://layerzero.gitbook.io/docs/technical-reference/testnet/testnet-addresses
const remoteChainId = 10121; // goerli
const remoteEthxAddress = '0x33cd7Bdb353196BbAbB555Abbe35D35Ee87D3D74';

// Polygon zkEVM
// const provider = new ethers.providers.JsonRpcProvider(`https://zkevm-rpc.com`);

async function main() {
  const ethxOFT = ETHxOFT__factory.connect(ethxOFTAddress, provider);

  let remoteAndLocal = ethers.utils.solidityPack(
      ['address','address'],
      [remoteEthxAddress, ethxOFTAddress]
  )

  let isTrustedRemote = await ethxOFT.isTrustedRemote(remoteChainId, remoteAndLocal);
  console.log(`Is trusted remote: ${isTrustedRemote}`);
  if (isTrustedRemote) {
    return;
  }

  const admin = new ethers.Wallet(privateKey, provider);
  const trans = await ethxOFT.connect(admin).setTrustedRemote(remoteChainId, remoteAndLocal);
  await trans.wait();
  console.log(`Set trusted remote`);
  isTrustedRemote = await ethxOFT.isTrustedRemote(remoteChainId, remoteAndLocal);
  console.log(`Is trusted remote: ${isTrustedRemote}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
