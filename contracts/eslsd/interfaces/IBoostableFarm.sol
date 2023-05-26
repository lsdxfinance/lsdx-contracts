// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

interface IBoostableFarm {
  function notifyStakeAmountUpdate(address account) external;
}