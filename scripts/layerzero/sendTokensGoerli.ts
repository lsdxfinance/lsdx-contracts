import * as _ from 'lodash';
import dotenv from "dotenv";
import { ethers } from "hardhat";
import { ETHxProxyOFTV2__factory, ERC20__factory } from '../../typechain';

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

async function main() {
  const ethxProxy = ETHxProxyOFTV2__factory.connect(ethxProxyOFTV2Address, provider);

  const admin = new ethers.Wallet(privateKey, provider);
  const toAddress = admin.address;
  const amount = ethers.utils.parseUnits('0.01', 18);

  const toAddressBytes = ethers.utils.defaultAbiCoder.encode(['address'],[toAddress]);
  // quote fee with default adapterParams
  let adapterParams = ethers.utils.solidityPack(["uint16", "uint256"], [1, 200000]) // default adapterParams example
  let fees = await ethxProxy.estimateSendFee(remoteChainId, toAddressBytes, amount, false, adapterParams);
  console.log(`fees[0] (wei): ${fees[0]} / (eth): ${ethers.utils.formatEther(fees[0])}`);

  // approve
  const ethx = ERC20__factory.connect(ethxAddress, provider);
  let trans = await ethx.connect(admin).approve(ethxProxy.address, amount);
  await trans.wait();
  console.log(`Approved ETHx transfer of ${ethers.utils.formatUnits(amount, 18)} to ETHxProxyOFTV2`);

  // send tokens
  const lzCallParamsStruct = {
    refundAddress: admin.address, 
    zroPaymentAddress: ethers.constants.AddressZero, 
    adapterParams: "0x"
  };
  trans = await ethxProxy.connect(admin).sendFrom(admin.address, remoteChainId, toAddressBytes, amount, lzCallParamsStruct, { value: fees[0] });
  await trans.wait();
  console.log(`Send tokens from ${admin.address} to ${toAddress} on remote chain ${remoteChainId} with amount ${ethers.utils.parseUnits(amount.toString(), 18)} ETHx`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
