import dotenv from "dotenv";
import "@typechain/hardhat";
import "hardhat-abi-exporter";
import "hardhat-gas-reporter"
import "@nomicfoundation/hardhat-toolbox";
import '@openzeppelin/hardhat-upgrades';
import { HardhatUserConfig } from "hardhat/config";
import { NetworkUserConfig } from "hardhat/types";

dotenv.config();

// Set Proxy
// const proxyUrl = 'http://127.0.0.1:49213';
// const { ProxyAgent, setGlobalDispatcher } = require("undici");
// const proxyAgent = new ProxyAgent(proxyUrl);
// setGlobalDispatcher(proxyAgent);

const chainIds = {
  hardhat: 31337,
  ganache: 1337,
  mainnet: 1,
  rinkeby: 4,
  goerli: 5,
  polygonZkEVM: 1101,
  polygonZkEVMTestnet: 1442
};

// Ensure that we have all the environment variables we need.
const privateKey: string = process.env.PRIVATE_KEY || "";
const infuraKey: string = process.env.INFURA_KEY || "";

function createTestnetConfig(network: keyof typeof chainIds): NetworkUserConfig {
  if (!infuraKey) {
    throw new Error("Missing INFURA_KEY");
  }

  let nodeUrl;
  switch (network) {
    case "mainnet":
      nodeUrl = `https://mainnet.infura.io/v3/${infuraKey}`;
      break;
    case "rinkeby":
      nodeUrl = `https://rinkeby.infura.io/v3/${infuraKey}`;
      break;
    case "goerli":
      nodeUrl = `https://goerli.infura.io/v3/${infuraKey}`;
      break;
    case "polygonZkEVM":
      nodeUrl = `https://zkevm-rpc.com`;
      break;
    case "polygonZkEVMTestnet":
      nodeUrl = `https://rpc.public.zkevm-test.net`;
      break;
  }

  return {
    chainId: chainIds[network],
    url: nodeUrl,
    accounts: [`${privateKey}`],
  };
}

const config: HardhatUserConfig = {
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    compilers: [
      {
        version: "0.8.12",
        settings: {
          metadata: {
            bytecodeHash: "ipfs",
          },
          // You should disable the optimizer when debugging
          // https://hardhat.org/hardhat-network/#solidity-optimizer-support
          optimizer: {
            enabled: true,
            runs: 590,
          },
        },
      },
      {
        version: "0.4.18"
      },
      {
        version: "0.5.16"
      },
      {
        version: "0.6.6"
      },
      {
        version: "0.6.12"
      },
      {
        version: "0.7.6"
      },
      {
        version: "0.8.10"
      },
    ]
  },
  abiExporter: {
    flat: true,
  },
  mocha: {
    parallel: false
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v5",
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_KEY || '',
      rinkeby: process.env.ETHERSCAN_KEY || '',
      goerli: process.env.ETHERSCAN_KEY || '',
      polygonZkEVMTestnet: process.env.ZKEVM_POLYGONSCAN_KEY || ''
    },
    customChains: [
      {
        network: "polygonZkEVMTestnet",
        chainId: 1442,
        urls: {
          apiURL: "https://api-testnet-zkevm.polygonscan.com/api",
          browserURL: "https://testnet-zkevm.polygonscan.com"
        }
      }
    ]
  }
};

if (privateKey) {
  config.networks = {
    mainnet: createTestnetConfig("mainnet"),
    goerli: createTestnetConfig("goerli"),
    rinkeby: createTestnetConfig("rinkeby"),
    polygonZkEVM: createTestnetConfig("polygonZkEVM"),
    polygonZkEVMTestnet: createTestnetConfig("polygonZkEVMTestnet")
  };
}

config.networks = {
  ...config.networks,
  hardhat: {
    chainId: 1337,
    gas: 'auto',
    gasPrice: 'auto',
    allowUnlimitedContractSize: true
  },
};

export default config;