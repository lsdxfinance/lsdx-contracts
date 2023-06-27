import * as _ from 'lodash';
import dotenv from "dotenv";
import { ethers } from "hardhat";
import { ETHxProxyOFT__factory } from '../../typechain';

dotenv.config();

const privateKey: string = process.env.PRIVATE_KEY || "";
const infuraKey: string = process.env.INFURA_KEY || "";

// Goerli for Polygon zkEVM Testnet
// const provider = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/${infuraKey}`);
// const ethxProxyOFTAddress = '0x33cd7Bdb353196BbAbB555Abbe35D35Ee87D3D74';
// // ref: https://layerzero.gitbook.io/docs/technical-reference/testnet/testnet-addresses
// const remoteChainId = 10158; // zksync-testnet
// const remoteEthxAddress = '0xb16b9F9CaA3fdAD503eD35E1d7C773f2BE79E0B1';

// Goerli for Optimism Goerli
const provider = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/${infuraKey}`);
const ethxProxyOFTAddress = '0xAefaB3500ECd1Fa75C8A806A8E6FCEbd09d622Df';
const remoteChainId = 10132;
const remoteEthxAddress = '0x0839aF3391d05e28328E99Fe234023c2d22b3Fc2';

// mainnet
// const provider = new ethers.providers.JsonRpcProvider(`https://mainnet.infura.io/v3/${infuraKey}`);
// const ethxProxyOFTAddress = '';

async function main() {
  const ethxProxy = ETHxProxyOFT__factory.connect(ethxProxyOFTAddress, provider);

  let remoteAndLocal = ethers.utils.solidityPack(
      ['address','address'],
      [remoteEthxAddress, ethxProxyOFTAddress]
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
