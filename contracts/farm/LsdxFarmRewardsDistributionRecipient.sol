// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

abstract contract LsdxFarmRewardsDistributionRecipient {
  address public rewardsDistribution;

  function notifyRewardAmount(uint256 reward, uint256 durationInDays) external virtual;

  modifier onlyRewardsDistribution() {
    require(msg.sender == rewardsDistribution, "Caller is not RewardsDistribution contract");
    _;
  }
}