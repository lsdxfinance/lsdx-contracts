// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

import "./lib/CurrencyTransferLib.sol";
import "./interfaces/IWETH.sol";
import "./StakingPool.sol";

contract EthStakingPool is StakingPool {

  IWETH public weth;
 
  /* ========== CONSTRUCTOR ========== */

  constructor(
    address _rewardsDistribution,
    address _rewardsToken,
    address _nativeTokenWrapper,
    uint256 _durationInDays
  ) StakingPool(_rewardsDistribution, _rewardsToken, _nativeTokenWrapper, _durationInDays) {
    weth = IWETH(_nativeTokenWrapper);
  }

  function _transferStakingToken(uint256 amount) override internal virtual {
    CurrencyTransferLib.transferCurrency(CurrencyTransferLib.NATIVE_TOKEN, msg.sender, address(this), amount);
    weth.deposit{value: amount}();
  }

  function _withdrawStakingToken(uint256 amount) override internal virtual {
    weth.withdraw(amount);
    CurrencyTransferLib.transferCurrency(CurrencyTransferLib.NATIVE_TOKEN, address(this), msg.sender, amount);
  }

}
