import { ethers } from "hardhat";
import dotenv from "dotenv";

dotenv.config();

const privateKey: string = process.env.PRIVATE_KEY || "";
const infuraKey: string = process.env.INFURA_KEY || "";

// Goerli
const lsdCoinAddress = '0x6a45C5515CD20905e6A971A3185D82E8988aA826';
const ethxAddress = '0xE3AA29cC330c5dd28429641Dd50409553f1f4476';
const ethxPoolAddress = '0x0Bd61885112A7415E39c49818aFd9eB41BF4fC39';
const lsdEthPairAddress = '0x4ee39d23773Fa2caa6c9AD9aeaD67491eB2aB095';
const provider = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/${infuraKey}`);

// mainnet
// const lsdCoinAddress = '0xfAC77A24E52B463bA9857d6b758ba41aE20e31FF';
// const ethxAddress = '0x21eAD867C8c5181854f6f8Ce71f75b173d2Bc16A';
// const ethxPoolAddress = '0x7b0Eff0C991F0AA880481FdFa5624Cb0BC9b10e1';
// const lsdEthPairAddress = '0x3322f41dfa379b6d3050c1e271b0b435b3ee3303';
// const provider = new ethers.providers.JsonRpcProvider(`https://mainnet.infura.io/v3/${infuraKey}`);

const deployer = new ethers.Wallet(privateKey, provider);

async function main() {
  const ESLSD = await ethers.getContractFactory('esLSD');
  const esLSD = await ESLSD.deploy(lsdCoinAddress);
  console.log(`Deployed esLSD to ${esLSD.address}`);

  const BoostableFarm = await ethers.getContractFactory('BoostableFarm');
  const boostableFarm = await BoostableFarm.deploy(esLSD.address, ethxAddress);
  console.log(`Deployed BoostableFarm to ${boostableFarm.address}`);

  const RewardBooster = await ethers.getContractFactory('RewardBooster');
  const rewardBooster = await RewardBooster.deploy(lsdEthPairAddress, ethxPoolAddress, boostableFarm.address, esLSD.address);
  console.log(`Deployed RewardBooster to ${rewardBooster.address}`);

  let trans = await boostableFarm.connect(deployer).setRewardBooster(rewardBooster.address);
  await trans.wait();
  console.log(`Set BoostableFarm's RewardBooster to ${rewardBooster.address}`);

  trans = await esLSD.connect(deployer).setZapDelegator(rewardBooster.address);
  await trans.wait();
  console.log(`Set esLSD's zap delegator to ${rewardBooster.address}`)

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
