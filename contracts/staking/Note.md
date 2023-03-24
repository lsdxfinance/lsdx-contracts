
# Staking Pools

### 核心合约

Staking Pool 的核心机制和 Uniswap V2 的 LP Staking 相同。核心合约有两个：

- **StakingPoolFactory**，创建并管理 StakingPool 合约

- **StakingPool**，staking 的核心合约，用户与其交互完成质押、提取奖励、退出质押等功能。**EthStakingPool** 是 StakingPool 的子类，它会自动将用户存入的 ETH 转化成 WETH，并且在用户提款时再将 WETH 转回 ETH 打给用户。

### StakingPool

- StakingPool 的机制比较灵活，挖矿活动可以分成很多个阶段 (round，以天为单位)，每个 round 对应不同数量的 $LSD 奖励

- 假设一个 round 是 7 天，那么 admin 每次调用 StakingPoolFactory.addRewards() 时，都会开启一个新的为期 7 天的挖矿周期， $LSD 奖励按 7 天平均发放

- 如果调用 StakingPoolFactory.addRewards() 时，上一个 round 还没有结束 (比如只过去了 3 天)，那么剩余的奖励也会叠加到新的为期 7 天的挖矿周期中，平均释放

- 即使当前 round 已经结束，仍然可以调用 StakingPoolFactory.addRewards() 开启一轮新的挖矿周期

### StakingPool 的主要接口

- `periodFinish()`：挖矿结束时间 (当前这个 round)

- `rewardRate()`：每一秒发放的 $LSD 总量

- `rewardPerToken()`：当前每一个 staking token 对应的 $LSD 奖励

- `totalSupply()`：用户当前存入的 staking token 的总量

- `balanceOf()`：每个用户存入的 staking token 的数量

- `earned()`：用户待提出的 $LSD 奖励的数量

- `getReward()`：提取 $LSD 奖励

- `stake()`：质押 staking token 开始挖矿

- `withdraw()`: 提取部分或者全部 staking token

- `exit()`：提取 $LSD 奖励并退出全部 staking token


### stETH 利息收入

stETH 是一种 rebasable 的 ERC20 代币，每个帐户的 stETH balance 会随着时间自动增加，以包含用户在 Lido ETH staking 的利息收入。

当用户存入 stETH 到 StakingPool 时，合约里会记下用户存入时的 stETH 数量，用户退出时，也只能提取同样的 stETH。那么，在此期间产生的 stETH 利息，将会自动留存在 StakingPool 合约中。

Admin 在质押结束后，可以调用 StakingPoolFactory.withdrawELRewards() 来提取多余的 stETH 利息。

另外，StakingPoolFactory.withdrawELRewards() 还有一个额外的功能，就是如果用户不小心直接转 ERC20 代币给 StakingPool (或者直接转 ETH 给 EthStakingPool)，那么 Admin 同样可以调用该方法将这些多余的 token 取出返还给用户。