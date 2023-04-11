
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

# Verifi LsdxTreasury. Edit ./scripts/lsdxTreasuryArguments.js, and:
$ hh verify --network goerli --constructor-args ./scripts/lsdxTreasuryArguments.js <address>
```

## Address

### Goerli

- veLSD: 0x7EC67D32B95Cd4E576cda4F4E9491bFbA38758F3
- LsdxTreasury: 0xFf075c2E9a6762A508D4b6171bA915FFC6115132