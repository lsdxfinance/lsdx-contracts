# veLSD

\$veLSD 是一种标准的 ERC20 代币，只是从设计上类似于 Soulbound Token，禁止 Transfer，仅作为用户在 LSDx 国库中质押 $LSD 获取国库奖励的凭证。

veLSD 合约部署后即将 minter 权限转移给 LsdxTreasury

- 用户存入 \$LSD 到 LsdxTreasury 时，LsdxTreasury mint 同样数量的 \$veLSD 给用户。

- 用户可以随时从 LsdxTreasury 赎回 \$LSD。赎回时，\$veLSD 被 LsdxTreasury 销毁，但会根据锁定的时间扣除相应比例的 \$LSD 留在国库。

> 为了尽量与 ERC20 接口兼容，\$veLSD 的 approve 接口仍然保留，不过并没有实际效果， approve 后仍然无法转帐


# LsdxTreasury

## 描述

LsdxTreasury 合约主要包括以下功能：

- \$veLSD 的 mint & burn

- 多种 reward token 的奖励释放、分发

- rewards 的注入。支持 rewarder 角色。每个 rewarder 帐户均可随时注入某种代币奖励，并且在注入时指定释放周期

## 接口

### 用户接口

- `totalSupply()`：用户当前存入的 \$LSD 的总量

- `balanceOf()`：每个用户存入的 \$LSD 的数量，应该始终等于用户当前持有的 \$veLSD 的数量

- `periodFinish(rewardToken)`：某个 reward token 当前或者最近一个周期的奖励释放结束时间

- `rewardRate(rewardToken)`：每一秒发放的某 reward token 总量

- `rewardsPerToken(rewardToken)`：当前每一个 \$veLSD 对应的 reward token 奖励

- `earned(account, rewardToken)`：用户待提取的 reward token 奖励的数量

- `velsdLockedCount()`: 查询用户有几笔 \$veLSD 锁定

- `velsdLockedInfoByIndex()`: 查询用户某笔 \$veLSD 的锁定详情

- `depositAndLockToken()`：质押 $LSD 到国库，1:1 获取锁定的 \$veLSD，并开始获取国库奖励

- `getRewards()`：提取国库奖励

- `calcAdminFee()`: 根据锁定时间，计算某一笔 \$veLSD 如果现在赎回需要扣除的 \$LSD 的数量

- `withdrawFirstSumOfLockedToken()`: 将锁定的 \$veLSD 中的最早的一笔兑换回 \$LSD (根据锁定时间长短，可能会扣除一部分 \$LSD 留在国库)

- `exitFirstSumOfLockedToken()`: 将锁定的 \$veLSD 中的最早的一笔兑换回 \$LSD (根据锁定时间长短，可能会扣除一部分 \$LSD 留在国库)，并提取所有奖励

### Admin 接口

- `addRewardToken()`: 添加一种新的 reward token

- `addRewards()`: 注入一笔某种 reward token 的奖励，开启一轮新的释放周期 (以天为单位)

- `addRewarder()`: 授予某帐号 rewarder 权限 (具有 rewarder 权限的帐户可以调用 addRewards() 注入奖励，或者调用 withdrawAdminFee() 来提取 admin fee)

- `removeRewarder()`: 收回某帐号的 rewarder 权限

- `withdrawAdminFee()`: 提取 admin fee