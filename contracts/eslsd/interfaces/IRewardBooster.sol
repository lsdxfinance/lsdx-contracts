// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

interface IRewardBooster {
  function stakeFor(address user, uint256 amount) external;
  function getBoostRate(address user, uint256 ethxAmount) external view returns (uint256);
}