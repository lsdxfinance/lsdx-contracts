
## Deploy

### Prepare `.env` 

With same keys to `.env-example`

### Deploy

```sh
$ hh run scripts/deployLsdxTreasury.ts --network <mainnet/goerli>
```

### Etherscan Verification

```sh
# Verifi veLSD
$ hh verify --network <mainnet/goerli> <address>

# Verifi LsdxTreasury. Edit ./scripts/lsdxTreasuryArguments.js or lsdxTreasuryArgumentsGoerli, and:
$ hh verify --network goerli --constructor-args ./scripts/lsdxTreasuryArgumentsGoerli.js <address>
```

## Contract Addresses

### Goerli

- veLSD: 0x7EC67D32B95Cd4E576cda4F4E9491bFbA38758F3
- LsdxTreasury: 0xFf075c2E9a6762A508D4b6171bA915FFC6115132

### Mainnet

- veLSD: 0x72e003ea1FA945De91A1426eA96Ac3FeEc91D654
- LsdxTreasury: 0x018fcCCe22D26E913238D42A6F388687EFE9B248