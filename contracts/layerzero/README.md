
# Polygon zkEVM (Testnet)

## Step 1: Deploy ETHx Proxy on Goerli

```sh
$ hh run scripts/layerzero/deployETHxProxyOFTV2.ts --network goerli

$ hh verify --network goerli 0x84DD87eB0fC034A098f7145a2f2d4C159359215A ...
```

## Step 2: Deploy ETHx OFTV2 on Polygon zkEVM

```sh
$ hh run scripts/layerzero/deployETHxOFTV2.ts --network polygonZkEVMTestnet

$ hh flatten ./contracts/layerzero/ETHxOFTV2.sol > ./contracts/layerzero/ETHxOFTV2_FLATTENED.sol
$ hh verify --contract contracts/layerzero/ETHxOFTV2.sol:ETHxOFTV2 --network polygonZkEVMTestnet 0x0839aF3391d05e28328E99Fe234023c2d22b3Fc2 0x6aB5Ae6822647046626e83ee6dB8187151E1d5ab 0 8
```

## Step 3: Set trusted endpoint

```sh
$ hh run scripts/layerzero/setTrustedRemoteGoerli.ts --network goerli

$ hh run scripts/layerzero/setTrustedRemotePolygonZkEVM.ts --network polygonZkEVMTestnet
```

## Test

```sh

```

## Addresses

- Goerli ETHx: 0xE3AA29cC330c5dd28429641Dd50409553f1f4476
- Goerli ETHxProxyOFTV2: 0x84DD87eB0fC034A098f7145a2f2d4C159359215A
- Polygon zkEVM Testnet ETHx: 0x0839aF3391d05e28328E99Fe234023c2d22b3Fc2

## Ref

https://zkevm.polygon.technology/docs/develop