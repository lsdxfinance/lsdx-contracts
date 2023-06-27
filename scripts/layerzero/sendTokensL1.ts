import * as _ from 'lodash';
import dotenv from "dotenv";
import { ethers } from "hardhat";
import { ETHxProxyOFT__factory, ERC20__factory } from '../../typechain';

dotenv.config();

const privateKey: string = process.env.PRIVATE_KEY || "";
const infuraKey: string = process.env.INFURA_KEY || "";

// // Goerli to Polygon zkEVM Testnet
// const provider = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/${infuraKey}`);
// const ethxAddress = '0xE3AA29cC330c5dd28429641Dd50409553f1f4476';
// const ethxProxyOFTAddress = '0x33cd7Bdb353196BbAbB555Abbe35D35Ee87D3D74';
// // ref: https://layerzero.gitbook.io/docs/technical-reference/testnet/testnet-addresses
// const remoteChainId = 10158; // zksync-testnet

// Goerli to Optimistic Goerli
const provider = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/${infuraKey}`);
const ethxAddress = '0xE3AA29cC330c5dd28429641Dd50409553f1f4476';
const ethxProxyOFTAddress = '0xAefaB3500ECd1Fa75C8A806A8E6FCEbd09d622Df';
const remoteChainId = 10132;

// mainnet
// const provider = new ethers.providers.JsonRpcProvider(`https://mainnet.infura.io/v3/${infuraKey}`);

async function main() {
  const ethxProxy = ETHxProxyOFT__factory.connect(ethxProxyOFTAddress, provider);

  const admin = new ethers.Wallet(privateKey, provider);
  const toAddress = admin.address;
  const amount = ethers.utils.parseUnits('1', 18).div(100);

  // const toAddressBytes = ethers.utils.defaultAbiCoder.encode(['address'],[toAddress]);
  // quote fee with default adapterParams
  let adapterParams = ethers.utils.solidityPack(["uint16", "uint256"], [1, 200000]) // default adapterParams example
  let fees = await ethxProxy.estimateSendFee(remoteChainId, toAddress, amount, false, adapterParams);
  console.log(`fees[0] (wei): ${fees[0]} / (eth): ${ethers.utils.formatEther(fees[0])}`);

  // approve
  const ethx = ERC20__factory.connect(ethxAddress, provider);
  const trans = await ethx.connect(admin).approve(ethxProxy.address, amount);
  await trans.wait();
  console.log(`Approved ETHx transfer of ${ethers.utils.formatUnits(amount, 18)} to ETHxProxyOFT`);

  // send tokens
  const sendTrans = await ethxProxy.connect(admin).sendFrom(admin.address, remoteChainId, toAddress, amount, admin.address, ethers.constants.AddressZero, "0x", { value: fees[0] });
  await sendTrans.wait();
  console.log(`Send tokens from ${admin.address} to ${toAddress} on remote chain ${remoteChainId} with amount ${ethers.utils.parseUnits(amount.toString(), 18)} ETHx`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
