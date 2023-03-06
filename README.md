# LSDx Contracts

## Compile

Cloning repository and install dependencies:

```sh
$ git clone <repository-url>

$ cd lsdx-contracts

$ yarn
```
Compile contracts:

```sh
# Use `hardhat-shorthand`:
$ hh compile

# Or, use `yarn`:
$ yarn run hardhat compile

# Or, use `npx`:
$ npx hardhat compile
```

## Run Test Cases

```sh
$ hh test

# To run test cases of a test file:
$ hh test ./test/xxx.ts
```

## Deploy

### Prepare `.env` 

With same keys to `.env-example`

### Deploy LsdCoin

```sh
$ hh run scripts/deployLsdCoin.ts --network <mainnet/goerli>

# Etherscan verify
$ hh verify --network <mainnet/goerli> <address>
```

### Deploy StakingPoolFactory

Edit `scripts/deployStakingPoolFactory.ts` with correct address of LsdCoin and WETH, and then:

```sh
$ hh run scripts/deployStakingPoolFactory.ts --network <mainnet/goerli>

# Etherscan verify
$ hh verify --network <mainnet/goerli> <address> <lsdcoin-address> <weth-address>
```

### Deploy StakingPools as needed

Edit `scripts/deployStakingPools.ts` with correct info, and then:

```sh
$ hh run scripts/deployStakingPools.ts --network <mainnet/goerli>

# Etherscan verify
$ hh verify --network <mainnet/goerli> <pool-address> <StakingPoolFactory-address> <lsdcoin-address> <staking-token-address | weth-address> <round-duration-in-days>
```

## Deployment Addresses

### Goerli

- **LsdCoin**: 0x6a45C5515CD20905e6A971A3185D82E8988aA826

- **StakingPoolFactory**: 0x9d0206522434011D1C6F011376e57519D5C6E4Da

  - ETH StakingPool
    - **ETH**: 0x0000000000000000000000000000000000000000
    - **StakingPool**: 0xc4dF24cfDb54F84746d2945235db954C5869450e

  - stETH StakingPool
    - **stETH**: 0x1643E812aE58766192Cf7D2Cf9567dF2C37e9B7F
    - **StakingPool**: 0x834B33F50AeB7dB07fCeDfAbC3999B7AdbE6d5A9

  - sfrxETH StakingPool
    - **sfrxETH**: 0x7e74D46a4E7C0cce7E0c29EA080b55e6bEE2ff21
    - **StakingPool**: 0x9Ae1C66fB951464267eF1569278F6D014BAD7050

  - LSD-ETH UNI V2 LP StakingPool
    - **LP Token**: 0x4ee39d23773Fa2caa6c9AD9aeaD67491eB2aB095
    - **StakingPool**: 0xa4B3681bD4774481659394360b82Cc9E82d90080