// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

interface IesLSD {
  function isAddressWhitelisted(address account) external view returns (bool);
  function zapVest(uint256 amount, address to) external;
}