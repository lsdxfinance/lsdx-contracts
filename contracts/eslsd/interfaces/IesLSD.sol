// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

interface IesLSD {
  function zapDelegator() external view returns (address);
  function zapVest(uint256 amount, address to) external;
}