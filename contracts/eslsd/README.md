
## Deploy

### Prepare `.env` 

With same keys to `.env-example`

### Deploy LsdCoin

```sh
$ hh run scripts/v2/deployLsdxV2Contracts.ts --network <mainnet/goerli>

# Etherscan verify
$ hh verify --network <mainnet/goerli> <address>
```

# Contract Addresses

## Goerli

- esLSD: 0x56c2677D2fb9328ea652b69f6091738Bd9EdA1c5

- BoostableFarm: 0x582a11e5727C37Eb90443bd2Afa353a810024Fd7

- RewardBooster: 0x13CB59a8313FE6F04CCee267562fe5f1012e803f

- Votes: 0xCb68A7A7558f46aBb20BA1BE7C5abd429E9fFAe6