// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import "@openzeppelin/contracts/access/Ownable.sol";

import './StakingPool.sol';

contract StakingPoolFactory is Ownable {
  using SafeMath for uint256;

  // immutables
  address public rewardsToken;

  // info about rewards for a particular staking token
  struct StakingPoolInfo {
    address poolAddress;
    uint256 startTime;
    uint256 durationInDays;
    uint256 totalRewardsAmount;
  }

  // rewards info by staking token
  mapping(address => StakingPoolInfo) public stakingPoolInfoByStakingToken;

  event StakingPoolDeployed(
    address indexed poolAddress,
    address indexed stakingToken,
    uint256 startTime,
    uint256 durationInDays
  );

  constructor(
    address _rewardsToken
  ) Ownable() {
    rewardsToken = _rewardsToken;
  }

  function getStakingPoolAddress(address stakingToken) public virtual view returns (address) {
    StakingPoolInfo storage info = stakingPoolInfoByStakingToken[stakingToken];
    require(info.poolAddress != address(0), 'StakingPoolFactory::getPoolAddress: not deployed');
    return info.poolAddress;
  }

  ///// permissioned functions

  // deploy a by-stages staking reward contract for the staking token
  function deployPool(address stakingToken, uint256 startTime, uint256 durationInDays) public onlyOwner {
    StakingPoolInfo storage info = stakingPoolInfoByStakingToken[stakingToken];

    require(info.poolAddress == address(0), 'StakingPoolFactory::deployPool: already deployed');
    require(startTime >= block.timestamp, 'StakingPoolFactory::deployPool: start too soon');
    require(durationInDays > 0, 'StakingPoolFactory::deployPool: duration too short');

    info.poolAddress = address(new StakingPool(/*_rewardsDistribution=*/ address(this), rewardsToken, stakingToken, durationInDays));
    info.startTime = startTime;
    info.durationInDays = durationInDays;
    info.totalRewardsAmount = 0;

    emit StakingPoolDeployed(info.poolAddress, stakingToken, startTime, durationInDays);
  }

  ///// permissionless functions

  /// @notice Deposit rewards. User need `approve` this contract to transfer rewards token before calling this method.
  function depositRewards(address stakingToken, uint256 rewardsAmount) public {
    StakingPoolInfo storage info = stakingPoolInfoByStakingToken[stakingToken];
    require(info.poolAddress != address(0), 'StakingPoolFactory::depositRewards: not deployed');
    require(block.timestamp >= info.startTime, 'StakingPoolFactory::depositRewards: not ready');

    if (rewardsAmount > 0) {
      info.totalRewardsAmount = info.totalRewardsAmount.add(rewardsAmount);

      require(
        IERC20(rewardsToken).transferFrom(msg.sender, info.poolAddress, rewardsAmount),
        'StakingPoolFactory::depositRewards: transfer failed'
      );
      StakingPool(info.poolAddress).notifyRewardAmount(rewardsAmount);
    }
  }
}