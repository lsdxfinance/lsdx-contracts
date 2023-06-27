import * as _ from 'lodash';
import dotenv from "dotenv";
import { ethers } from "hardhat";
import { ETHxOFT__factory } from '../../typechain';

dotenv.config();

const privateKey: string = process.env.PRIVATE_KEY || "";
const infuraKey: string = process.env.INFURA_KEY || "";

// // Polygon zkEVM testnet
// const provider = new ethers.providers.JsonRpcProvider(`https://rpc.public.zkevm-test.net`);
// const ethxAddress = '0xb16b9F9CaA3fdAD503eD35E1d7C773f2BE79E0B1';
// // ref: https://layerzero.gitbook.io/docs/technical-reference/testnet/testnet-addresses
// const remoteChainId = 10121; // goerli

// Optimistic Goerli
const provider = new ethers.providers.JsonRpcProvider(`https://optimism-goerli.infura.io/v3/${infuraKey}`);
const ethxAddress = '0x0839aF3391d05e28328E99Fe234023c2d22b3Fc2';
const remoteChainId = 10121; // goerli


// mainnet
// const provider = new ethers.providers.JsonRpcProvider(`https://zkevm-rpc.com`);

async function main() {
  const ethx = ETHxOFT__factory.connect(ethxAddress, provider);

  const admin = new ethers.Wallet(privateKey, provider);
  const toAddress = admin.address;
  const amount = ethers.utils.parseUnits('1', 18).div(100);

  // const toAddressBytes = ethers.utils.defaultAbiCoder.encode(['address'],[toAddress]);
  // quote fee with default adapterParams
  let adapterParams = ethers.utils.solidityPack(["uint16", "uint256"], [1, 200000]) // default adapterParams example
  let fees = await ethx.connect(admin).estimateSendFee(remoteChainId, toAddress, amount, false, adapterParams);
  console.log(`fees[0] (wei): ${fees[0]} / (eth): ${ethers.utils.formatEther(fees[0])}`);

  // send tokens
  const sendTrans = await ethx.connect(admin).sendFrom(admin.address, remoteChainId, toAddress, amount, admin.address, ethers.constants.AddressZero, "0x", { value: fees[0] });
  await sendTrans.wait();
  console.log(`Send tokens from ${admin.address} to ${toAddress} on remote chain ${remoteChainId} with amount ${ethers.utils.parseUnits(amount.toString(), 18)} ETHx`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
