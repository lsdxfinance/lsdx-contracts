// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

interface IRewardBooster {
  function getBoostRate(address account, uint256 ethxAmount) external view returns (uint256);
}