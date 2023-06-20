// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

interface ISLPCore {
  function vETH2() external view returns (address);
  function mint() external payable;
  function calculateTokenAmount(uint256 vTokenAmount) external view returns (uint256 tokenAmount);
}