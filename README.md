# Leviosa Contracts

## Quick start

Cloning repository and install dependencies:

```sh
$ git clone xxxx

$ cd leviosa-contracts

$ yarn
```
To compile contracts:

```sh
# Use `hardhat-shorthand`:
$ hh compile

# Use `yarn`:
$ yarn run hardhat compile

# Use `npx`:
$ npx hardhat compile
```

To run test cases,

```sh
$ hh test

# To run test cases of a test file:
$ hh test ./test/xxx.ts

# To run all test cases with gas report:
$ REPORT_GAS=true hh test
```

To deploy to remote network

```sh
# Use `hardhat-shorthand`:
$ hh run scripts/deploy.ts --network [mainnet/rinkeby/goerli]
```

To verify:

```sh
# Use `hardhat-shorthand`:
$ hh verify --network [mainnet/rinkeby/goerli] <address>
```