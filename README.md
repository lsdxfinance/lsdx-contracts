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

### Deploy FlyCoin

```sh
$ hh run scripts/deployFlyCoin.ts --network <mainnet/goerli>

# Etherscan verify
$ hh verify --network <mainnet/goerli> <address>
```

### Deploy StakingPoolFactory

Edit `scripts/deployStakingPoolFactory.ts` with correct address of FlyCoin and WETH, and then:

```sh
$ hh run scripts/deployStakingPoolFactory.ts --network <mainnet/goerli>

# Etherscan verify
$ hh verify --network <mainnet/goerli> <address> <flycoin-address> <weth-address>
```

### Deploy StakingPools as needed

Edit `scripts/deployStakingPools.ts` with correct info, and then:

```sh
$ hh run scripts/deployStakingPools.ts --network <mainnet/goerli>

# Etherscan verify
$ hh verify --network <mainnet/goerli> <pool-address> <StakingPoolFactory-address> <flycoin-address> <staking-token-address | weth-address> <round-duration-in-days>
```
