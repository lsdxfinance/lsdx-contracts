// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

import "../FlyCoin.sol";

contract TestFlyCoinV2 is FlyCoin {

  function funcV2()
    public
    pure
    returns (bool)
  {
    return true;
  }
}