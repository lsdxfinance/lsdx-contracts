// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

interface IRewardBooster {
  function getStakeAmount(address account) external view returns (uint256, uint256);
}