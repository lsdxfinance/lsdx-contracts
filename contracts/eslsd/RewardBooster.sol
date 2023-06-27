// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';
import "./interfaces/IBoostableFarm.sol";
import "./interfaces/IRewardBooster.sol";
import "../interfaces/ICurvePool.sol";

contract RewardBooster is IRewardBooster, Ownable, ReentrancyGuard {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  IUniswapV2Pair public lsdEthPair;
  ICurvePool public ethxPool;
  IBoostableFarm public farm;
  address public zapStakeDelegator;

  uint256 public stakePeriod = 7 days;

  mapping(address => StakeInfo[]) public userStakes;
  uint256 public constant MAX_STAKES_COUNT_PER_USER = 10;

  uint256 public constant DECIMALS = 1e18;
  uint256 public constant MAX_BOOST_RATE = 10 * DECIMALS;
  uint256 public constant PRECISION = 1e10;

  struct StakeInfo {
    uint256 amount;
    uint256 startTime;
    uint256 endTime;
  }

  constructor(address _lsdEthPair, address _ethxPool, address _farm) Ownable() {
    require(_lsdEthPair != address(0), "Zero address detected");
    require(_ethxPool != address(0), "Zero address detected");
    require(_farm != address(0), "Zero address detected");

    lsdEthPair = IUniswapV2Pair(_lsdEthPair);
    ethxPool = ICurvePool(_ethxPool);
    farm = IBoostableFarm(_farm);
  }

  /*******************************************************/
  /***********************  VIEWS ************************/
  /*******************************************************/

  function ensureStakeCount(address user) external view {
    require(user != address(0), "Zero address detected");
    require(userStakes[user].length < MAX_STAKES_COUNT_PER_USER, "Too many stakes");
  }
 
  /**
   * @dev Get the amount of LP tokens that can be unstaked for a user
   * @return Amount of LP tokens that could be unstaked
   * @return Total amount of staked LP tokens
   */
  function getStakeAmount(address account) public view returns (uint256, uint256) {
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

  function getBoostRate(address account, uint256 ethxAmount) external view returns (uint256) {
    (, uint256 lpAmount) = getStakeAmount(account);
    (uint256 ethReserve, , ) = lsdEthPair.getReserves();
    uint256 lpAmountETHValue = lpAmount.mul(PRECISION).mul(ethReserve).div(lsdEthPair.totalSupply()).mul(2);

    uint256 ethxAmountETHValue = ICurvePool(ethxPool).get_virtual_price().mul(ethxAmount).div(DECIMALS);
    if (ethxAmountETHValue == 0) {
      return 1 * DECIMALS;
    }

    uint256 boostRate = lpAmountETHValue.mul(DECIMALS).div(ethxAmountETHValue).div(PRECISION);
    return Math.min(boostRate.add(1 * DECIMALS), MAX_BOOST_RATE);
  }

  /*******************************************************/
  /****************** MUTATIVE FUNCTIONS *****************/
  /*******************************************************/

  function stake(uint256 amount) external nonReentrant {
    _stakeFor(_msgSender(), amount);
    emit Stake(_msgSender(), amount, stakePeriod);
  }

  function delegateZapStake(address user, uint256 amount) external nonReentrant onlyZapStakeDelegator(_msgSender()) {
    _stakeFor(user, amount);
    emit DelegateZapStake(user, amount, stakePeriod);
  }

  function _stakeFor(address user, uint256 amount) private {
    require(user != address(0), "Zero address detected");
    require(amount > 0, "Amount must be greater than 0");
    require(userStakes[user].length < MAX_STAKES_COUNT_PER_USER, "Too many stakes");

    IERC20(address(lsdEthPair)).safeTransferFrom(_msgSender(), address(this), amount);

    StakeInfo memory stakeInfo = StakeInfo(amount, block.timestamp, block.timestamp.add(stakePeriod));
    userStakes[user].push(stakeInfo);

    farm.updateBoostRate(user);
  }

  function unstake() external nonReentrant {
    uint256 unstakeableAmount = 0;
    for (uint256 index = 0; index < userStakes[_msgSender()].length; ) {
      StakeInfo storage stakeInfo = userStakes[_msgSender()][index];

      if (stakeInfo.amount > 0 && block.timestamp >= stakeInfo.endTime) {
        unstakeableAmount = unstakeableAmount.add(stakeInfo.amount);
        IERC20(address(lsdEthPair)).safeTransfer(_msgSender(), stakeInfo.amount);
        emit Unstake(_msgSender(), stakeInfo.amount);
        _deleteStakeInfo(index);
      }
      else {
        index++;
      }
    }

    require(unstakeableAmount > 0, "No tokens to unstake");
    farm.updateBoostRate(_msgSender());
  }


  /********************************************/
  /*********** RESTRICTED FUNCTIONS ***********/
  /********************************************/

  function setZapStakeDelegator(address _zapStakeDelegator) external onlyOwner {
    require(_zapStakeDelegator != address(0), "Zero address detected");
    zapStakeDelegator = _zapStakeDelegator;
  }

  /********************************************************/
  /****************** INTERNAL FUNCTIONS ******************/
  /********************************************************/

  function _deleteStakeInfo(uint256 index) internal {
    userStakes[_msgSender()][index] = userStakes[_msgSender()][userStakes[_msgSender()].length - 1];
    userStakes[_msgSender()].pop();
  }

  /***********************************************/
  /****************** MODIFIERS ******************/
  /***********************************************/

  modifier onlyZapStakeDelegator(address _address) {
    require(zapStakeDelegator == _address, "Not zap stake delegator");
    _;
  }

  /********************************************/
  /****************** EVENTS ******************/
  /********************************************/

  event Stake(address indexed userAddress, uint256 amount, uint256 period);
  event DelegateZapStake(address indexed userAddress, uint256 amount, uint256 period);
  event Unstake(address indexed userAddress, uint256 amount);
}