// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

import "../coin/LsdCoin.sol";

contract TestLsdCoinV2 is LsdCoin {

  function funcV2()
    public
    pure
    returns (bool)
  {
    return true;
  }
}