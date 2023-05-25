// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IRewardBooster.sol";
import "../interfaces/IETHxPool.sol";
import "../interfaces/IUniswapV2Pair.sol";

contract RewardBooster is IRewardBooster, Ownable, ReentrancyGuard {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  IUniswapV2Pair public lsdEthPair;
  IETHxPool public ethxPool;

  uint256 public stakePeriod = 7 days;
  uint256 public constant MIN_STAKE_PERIOD = 3 days;
  uint256 public constant MAX_STAKE_PERIOD = 15 days;

  mapping(address => StakeInfo[]) public userStakes;
  uint256 public constant MAX_STAKES_COUNT_PER_USER = 10;

  struct StakeInfo {
    uint256 amount;
    uint256 startTime;
    uint256 endTime;
  }

  /* ========== CONSTRUCTOR ========== */
  constructor(address _lsdEthPair, address _ethxPool) Ownable() {
    require(_lsdEthPair != address(0), "Zero address detected");
    require(_ethxPool != address(0), "Zero address detected");
    lsdEthPair = IUniswapV2Pair(_lsdEthPair);
    ethxPool = IETHxPool(_ethxPool);
  }

  /* ========== VIEWS ========== */

  /**
   * @dev Get the amount of LP tokens that can be unstaked for a user
   * @return Amount of LP tokens that could be unstaked
   * @return Total amount of staked LP tokens
   */
  function getStakeAmount(address account) external view returns (uint256, uint256) {
    uint256 unstakeableAmount = 0;
    uint256 totalStakedAmount = 0;

    for (uint256 index = 0; index < userStakes[account].length; index++) {
      StakeInfo storage stakeInfo = userStakes[account][index];
      if (stakeInfo.amount > 0 && block.timestamp >= stakeInfo.endTime) {
        unstakeableAmount = unstakeableAmount.add(stakeInfo.amount);
      }
      totalStakedAmount = totalStakedAmount.add(stakeInfo.amount);
    }
    return (unstakeableAmount, totalStakedAmount);
  }

  /*******************************************************/
  /****************** MUTATIVE FUNCTIONS *****************/
  /*******************************************************/

  function unstake() external nonReentrant {
    for (uint256 index = 0; index < userStakes[_msgSender()].length; ) {
      StakeInfo storage stakeInfo = userStakes[_msgSender()][index];

      if (stakeInfo.amount > 0 && block.timestamp >= stakeInfo.endTime) {
        _deleteStakeInfo(index);
        IERC20(address(lsdEthPair)).safeTransfer(_msgSender(), stakeInfo.amount);
        emit Unstake(_msgSender(), stakeInfo.amount);
      }
      else {
        index++;
      }
    }
  }

  function stake(uint256 amount) external nonReentrant {
    require(amount > 0, "Amount must be greater than 0");
    require(userStakes[_msgSender()].length < MAX_STAKES_COUNT_PER_USER, "Too many stakes");

    IERC20(address(lsdEthPair)).safeTransferFrom(_msgSender(), address(this), amount);

    StakeInfo memory stakeInfo = StakeInfo(amount, block.timestamp, block.timestamp.add(stakePeriod));
    userStakes[_msgSender()].push(stakeInfo);

    emit Stake(_msgSender(), amount, stakeInfo.endTime);
  }

  /*******************************************************/
  /****************** RESTRICTED FUNCTIONS ***************/
  /*******************************************************/

  function setStakePeriod(uint256 _period) external onlyOwner nonReentrant {
    require(_period >= MIN_STAKE_PERIOD && _period <= MAX_STAKE_PERIOD, "Invalid lock period");
    require(_period != stakePeriod, "Same period");

    uint256 previousStakePeriod = stakePeriod;
    stakePeriod = _period;
    emit UpdateStakePeriod(previousStakePeriod, stakePeriod);
  }

  /********************************************************/
  /****************** INTERNAL FUNCTIONS ******************/
  /********************************************************/

  function _deleteStakeInfo(uint256 index) internal {
    userStakes[_msgSender()][index] = userStakes[_msgSender()][userStakes[_msgSender()].length - 1];
    userStakes[_msgSender()].pop();
  }

  /********************************************/
  /****************** EVENTS ******************/
  /********************************************/

  event UpdateStakePeriod(uint256 previousPeriod, uint256 period);
  event Stake(address indexed userAddress, uint256 amount, uint256 endTime);
  event Unstake(address indexed userAddress, uint256 amount);
}