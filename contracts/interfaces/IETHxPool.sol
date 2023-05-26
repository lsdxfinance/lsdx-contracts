// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IETHxPool {
  function get_virtual_price() external view returns (uint256);
  function admin_balances(uint256 i) external view returns (uint256);
}