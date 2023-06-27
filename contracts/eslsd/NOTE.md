
- [esLSD](#eslsd)
- [BoostableFarm](#boostablefarm)
- [RewardBooster](#rewardbooster)
- [Votes](#votes)

# esLSD

\$esLSD 是 LSDx V2 新版本中的 escrow token，用来代替旧版中的 \$veLSD，作为 Farm 池子的挖矿收益。

## 机制说明

- 用户锁定 \$LSD，1:1 获取 \$esLSD

- 用户可以随时将 \$esLSD 进行解锁。解锁的 \$esLSD 分为 90 天线性释放

- 用户可以随时提取已经解锁的 \$esLSD，1:1 兑换回 \$LSD

- 如果用户发起新的 \$esLSD 解锁，则之前未解锁的 \$esLSD 合并到新发起的部分，重新按照 90 天线性解锁。

- **Zap功能**: 另外，用户可以对正在解锁中的 $esLSD，配对 ETH 来 *Zap* 成 LSD/ETH LP，质押进 RewardBooster 合约，对挖矿进行 Boost 加速。

## 接口说明

- `escrow`: 将用户的 \$LSD 锁入 esLSD 合约，然后 1:1 mint 出 \$esLSD 给用户

- `vest`: 发起 \$esLSD 解锁，持续 90 天。待解锁的 \$esLSD 存入合约。如果有正在解锁中的 \$esLSD，则将已经解锁的 \$esLSD 自动兑换成 \$LSD 转给用户，剩余的 \$esLSD 合并到当前的这笔新的待解锁的 \$esLSD 中。

- `claim`: 将已经线性解锁的 \$esLSD 销毁 (注意这笔 \$esLSD 已经在用户调用 `vest` 方法时转入 esLSD 合约)，然后 1:1 将用户之前锁入的 \$LSD (通过调用 `escrow`) 转给用户。

- `claimableAmount`: 查询用户当前已经解锁的 \$esLSD 的数量。如果有的话，可以通过调用 `claim` 方法赎回。

- `zapVest`: 将用户已经 *vest* 但是还没有解锁的 \$esLSD，配对 ETH，转成 LSD/ETH LP token，质押进 *RewardBooster* 合约。
  - 已经解锁的 \$esLSD，自动转成 \$LSD 转给用户
  - 未解锁的 \$esLSD 的数量，合约中按 *block* 自动更新
  - 需要配对的 ETH 的数量，前端需要根据未解锁的 \$esLSD 数量、UIN LSD/ETH Pair 中的 \$LSD 和 \$WETH 的数量，来自动等比例计算
  - 超出的 ETH 会自动返还给用户

# BoostableFarm

新的 Farm 合约，支持用户质押 \$ETHx 代币获取 \$esLSD 奖励。

## 机制说明

- 底层的挖矿机制和 fork 自 [Uniswap Liquidity Staker](https://github.com/Uniswap/liquidity-staker) 的 V1 版本的 [StakingPool](../staking/StakingPool.sol) 一致，保持不变。
- 用户质押 \$ETHx 代币，挖取 \$esLSD 奖励
- 用户可以通过以下两种方式提高挖矿系数。Boost 系数根据用户质押的 \$ETHx 和用来加速的 LSDx/ETH LP 代币和 \$esLSD 代币的价值来计算，最高10倍。\$esLSD 的价格，根据 LSD/ETH UNI V2 来计算。
  - 用户直接质押 LSDx/ETH UNI V2 的 LP Token。
  - 用户通过调用 *esLSD.zapVest* 自动转换并质押进合约的 LSDx/ETH UNI V2 LP Token。

## 接口说明

大部分代码实现和接口，和 V1 版本一致。为了支持 Boost 而引入的改动主要有：

- 增加了 `_boostedBalances` 和 `_totalBoostedSupply` 来记录每个用户 Boost 后的数量。比如 Alice stake 了 10 个 \$ETHx，Boost 系数为 2，那么 Alice 的 *boosted balance* 为 20。
- 用户的 reward 改为根据 *boosted balance* 来计算
- `setRewardBooster`: 设置 `RewardBooster` 合约的地址。和 Boost Rate 相关的计算，统一放在 RewardBooster 中实现。
- 增加了 `updateBoostRate` 接口，这样在需要的时候，任何人 (比如用户自己、Admin、DAO合约、等等) 都可以调用该接口来触发更新指定用户的 Boost Rate

**关于 Boost Rate** 的更新

理论上来讲，用户的 *Boost Rate* 会根据 \$ETHx、\$LSD 的价格波动而实时波动。本合约支持两种方式来更新指定用户的 *Boost Rate*:

1. 自动更新。用户和合约正常交互时，自动更新自己的 *Boost Rate*，比如 `RewardBooster` 的 `stake`、`unstake` 或者 `esLSD`.`zapVest` 等等，会自动调用 `BoostableFarm.updateBoostRate`

2. 主动更新。如果用户长时间未和合约正常交互，但是实际 *Boost Rate* 发生偏离，可以主动调用 `BoostableFarm.updateBoostRate` 来触发更新。

# RewardBooster

Farm 合约的加速逻辑。用户可以通过以下两种方式，来提高 `BoostFarm` 的挖矿系数:

1. 直接质押 LSDx/ETH LP Token
2. 通过调用 `esLSD`.`zapVest`，额外配对 ETH，自动注入 \$LSD/ETH 进 UNI LSDx/ETH Pool，产生并自动质押进 RewardBooster 的 LSDx/ETH LP Token

可以质押多笔 (合约里限定每个用户每种最多质押10笔)，每一笔锁定 7 天，7 天后可以随时提出。

Boost 系数的计算公式为：

```
Boost Rate = 1 + 10 * (LP Value) / (ETHx Value)
```

其中，

- `ETHx Value`: 根据 ETHx 代币的 *virtual price* (参考 Curve 机制) 计算，将 ETHx 折成 ETH
- `LP Value`: 将 LSDx/ETH LP Token 折成 ETH

## 合约接口

- `getUserBoostRate`: 计算用户的 *Boost Rate*
- `getBoostRate`: 指定 LP 的数量，计算 *Boost Rate*
- `getStakeAmount`: 查询用户 LP 的总质押量、以及已经解锁的数量
- `stake`: stake 一笔新的 LP
- `unstake`: 提取已经解锁的 LP

# Votes

## 机制说明

- *Admin* 可以创建多个 Voting Pool。每个 Voting Pool 可以指定名称、用来贿选的 bribe token
- *User* 可以使用 \$esLSD 进行投票。投票时将 \$esLSD 质押到对应的 Voting Pool 中
- *Briber* 可以往 Voting Pool 中注入奖励 (bribe rewards)，注入的奖励按比例分发给当前的 *Voters*。贿选奖励可以多次注入。
- *User* 可以随时提取贿选奖励、增加或者减少投票数量
- *Admin* 可以选择 *deprecate* 某个 Voting Pool。被 *deprecated* 的 Voting Pool，禁止 *User* 再次质押 和 *Briber* 贿选，但不影响 *User* 提取奖励或者减少已经的投票。

## 接口说明

- `getVotingPools`: 查询所有的 Voting Pool。 `activeOnly` 用来控制是否过滤掉被 *deprecated* 的 Voting Pool

- `getVotingPool(poolId)`: 查询 Voting Pool 信息

- `totalVotes(poolId)`: 查询 Voting Pool 中用户总投票数

- `userVotes(poolId, account)`: 查询用户在某个 Voting Pool 中的投票数量

- `bribeRewardsEarned(poolId, account)`: 查询用户在某个 Voting Pool 中获得的贿选奖励

- `vote(poolId, amount)`: 投票

- `batchVote(BatchVoteParams[])`: 针对多个 Voting Pool 批量投票

- `unvote(poolId, amount)`: 减少投票数量

- `unvoteAll`: 撤出所有投票

- `getBribeRewards(poolId)`: 提取 Voting Pool 中的贿选奖励

- `getAllBribeRewards`: 提取所有 Voting Pool 中的贿选奖励

- `bribe(poolId, bribeAmount)`: *Briber* 调用，注入贿选奖励