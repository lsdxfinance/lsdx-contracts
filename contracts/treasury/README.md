
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

- veLSD: 0xe8340c7Bf483D3cB94E67C270CEA26edeFC8b2bC
- LsdxTreasury: 0xd4833D9Ad90AD1561D580F3575314B8cF74dC583