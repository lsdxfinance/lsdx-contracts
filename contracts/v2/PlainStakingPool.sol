// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./StakingPoolV2.sol";

contract PlainStakingPool is StakingPoolV2 {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  /* ========== CONSTRUCTOR ========== */

  constructor(
    address _rewardsToken,
    address _stakingToken,
    uint256 _durationInDays
  ) StakingPoolV2(_rewardsToken, _stakingToken, _durationInDays) {

  }

  function withdrawAdminRewards(address) external override virtual onlyOwner {
    revert Unsupported();
  }
}