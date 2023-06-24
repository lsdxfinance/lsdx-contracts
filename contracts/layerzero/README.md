
# Polygon zkEVM (Testnet)

## Step 1: Deploy ETHx Proxy on Goerli

```sh
$ hh run scripts/layerzero/deployETHxProxyOFT.ts --network goerli

$ hh verify --network goerli  ...
```

## Step 2: Deploy ETHx OFT on Polygon zkEVM

```sh
$ hh run scripts/layerzero/deployETHxOFT.ts --network polygonZkEVMTestnet

$ hh flatten ./contracts/layerzero/ETHxOFT.sol > ./contracts/layerzero/ETHxOFTV2_FLATTENED.sol
$ hh verify --contract contracts/layerzero/ETHxOFT.sol:ETHxOFT --network polygonZkEVMTestnet ...
```

## Step 3: Set trusted endpoint

```sh
$ hh run scripts/layerzero/setTrustedRemoteGoerli.ts --network goerli

$ hh run scripts/layerzero/setTrustedRemotePolygonZkEVM.ts --network polygonZkEVMTestnet
```

## Test

```sh
$ hh run scripts/layerzero/sendTokensGoerli.ts --network goerli

$ hh run scripts/layerzero/sendTokensPolygonZkEVM.ts --network polygonZkEVMTestnet
```

## Addresses

- Goerli ETHx: 0xE3AA29cC330c5dd28429641Dd50409553f1f4476
- Goerli ETHxProxyOFT: 0x33cd7Bdb353196BbAbB555Abbe35D35Ee87D3D74
- Polygon zkEVM Testnet ETHx: 0xb16b9F9CaA3fdAD503eD35E1d7C773f2BE79E0B1

## Ref

https://zkevm.polygon.technology/docs/develop