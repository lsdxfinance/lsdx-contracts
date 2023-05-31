// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

contract StableSwapETHxPool {

  uint256 internal _virtual_price = 1e18;

  function set_virtual_price(uint256 price) external {
    _virtual_price = price;
  }

  function get_virtual_price() external view returns (uint256) {
    return _virtual_price;
  }
}