
# Polygon zkEVM (Testnet)

## Step 1: Deploy ETHx Proxy on Goerli

```sh
$ hh run scripts/layerzero/deployETHxProxyOFTL1.ts --network goerli

$ hh verify --network goerli  ...
```

## Step 2: Deploy ETHx OFT on Polygon zkEVM

```sh
$ hh run scripts/layerzero/deployETHxOFTL2.ts --network polygonZkEVMTestnet

$ hh flatten ./contracts/layerzero/ETHxOFT.sol > ./contracts/layerzero/ETHxOFTV2_FLATTENED.sol
$ hh verify --contract contracts/layerzero/ETHxOFT.sol:ETHxOFT --network polygonZkEVMTestnet ...
```

## Step 3: Set trusted endpoint

```sh
$ hh run scripts/layerzero/setTrustedRemoteL1.ts --network goerli

$ hh run scripts/layerzero/setTrustedRemoteL2.ts --network polygonZkEVMTestnet
```

## Bridge tokens

```sh
$ hh run scripts/layerzero/sendTokensL1.ts --network goerli

$ hh run scripts/layerzero/sendTokensL2.ts --network polygonZkEVMTestnet
```

## Addresses

- Goerli ETHx: 0xE3AA29cC330c5dd28429641Dd50409553f1f4476
- Goerli ETHxProxyOFT: 0x33cd7Bdb353196BbAbB555Abbe35D35Ee87D3D74
- Polygon zkEVM Testnet ETHx: 0xb16b9F9CaA3fdAD503eD35E1d7C773f2BE79E0B1

## Ref

https://zkevm.polygon.technology/docs/develop


# Optimism (Testnet)

## Step 1: Deploy ETHx Proxy on Goerli

```sh
$ hh run scripts/layerzero/deployETHxProxyOFTL1.ts --network goerli

$ hh verify --network goerli  ...
```

## Step 2: Deploy ETHx OFT on Optimism Goerli

```sh
$ hh run scripts/layerzero/deployETHxOFTL2.ts --network optimisticGoerli

$ hh verify --network optimisticGoerli ...
```

## Step 3: Set trusted endpoint

```sh
$ hh run scripts/layerzero/setTrustedRemoteL1.ts --network goerli

$ hh run scripts/layerzero/setTrustedRemoteL2.ts --network optimisticGoerli
```

## Bridge tokens

```sh
$ hh run scripts/layerzero/sendTokensL1.ts --network goerli

$ hh run scripts/layerzero/sendTokensL2.ts --network optimisticGoerli
```

## Addresses

- Goerli ETHx: 0xE3AA29cC330c5dd28429641Dd50409553f1f4476
- Goerli ETHxProxyOFT: 0xAefaB3500ECd1Fa75C8A806A8E6FCEbd09d622Df
- Optimism Goerli ETHx: 0x0839aF3391d05e28328E99Fe234023c2d22b3Fc2