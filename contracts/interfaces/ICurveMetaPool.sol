// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

interface ICurveMetaPool {
  function add_liquidity(uint256[2] memory amounts, uint256 min_mint_amount) external payable;
  function get_virtual_price() external view returns (uint256);
  function admin_balances(uint256 i) external view returns (uint256);
  // for vETHx pool only
  function slp_core() external view returns (address);
}