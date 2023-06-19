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
import "./UniswapV2PairOracle.sol";
import "./interfaces/IBoostableFarm.sol";
import "./interfaces/IesLSD.sol";
import "./interfaces/IRewardBooster.sol";
import "./interfaces/IZapDelegator.sol";
import "../interfaces/ICurvePool.sol";

contract RewardBooster is IRewardBooster, IZapDelegator, Ownable, ReentrancyGuard {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  IUniswapV2Pair public lsdEthPair;
  UniswapV2PairOracle public lsdEthOracle;
  ICurvePool public ethxPool;
  IBoostableFarm public farm;
  IesLSD public esLSD;

  uint256 public stakePeriod = 7 days;
  uint256 public constant MIN_STAKE_PERIOD = 3 days;
  uint256 public constant MAX_STAKE_PERIOD = 15 days;

  mapping(address => StakeInfo[]) public userStakes;
  mapping(address => ZapStakeInfo[]) public userZapStakes;
  uint256 public constant MAX_STAKES_COUNT_PER_USER = 10;

  uint256 public constant DECIMALS = 1e18;
  uint256 public constant MAX_BOOST_RATE = 10 * DECIMALS;
  uint256 public constant PRECISION = 1e10;

  struct StakeInfo {
    uint256 amount;
    uint256 startTime;
    uint256 endTime;
  }

  struct ZapStakeInfo {
    uint256 amount;
    uint256 startTime;
    uint256 endTime;
  }

  constructor(address _lsdEthPair, address _ethxPool, address _farm, address _esLSD) Ownable() {
    require(_lsdEthPair != address(0), "Zero address detected");
    require(_ethxPool != address(0), "Zero address detected");
    require(_farm != address(0), "Zero address detected");
    require(_esLSD != address(0), "Zero address detected");

    lsdEthPair = IUniswapV2Pair(_lsdEthPair);
    lsdEthOracle = new UniswapV2PairOracle(_lsdEthPair);
    ethxPool = ICurvePool(_ethxPool);
    farm = IBoostableFarm(_farm);
    esLSD = IesLSD(_esLSD);
  }

  /*******************************************************/
  /***********************  VIEWS ************************/
  /*******************************************************/

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

  function getZapStakeAmount(address account) public view returns (uint256, uint256) {
    uint256 unstakeableAmount = 0;
    uint256 totalStakedAmount = 0;

    for (uint256 index = 0; index < userZapStakes[account].length; index++) {
      ZapStakeInfo storage stakeInfo = userZapStakes[account][index];
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

    (, uint256 zapStakeAmount) = getZapStakeAmount(account);
    uint256 zapStakeAmountETHValue = 0;
    if (zapStakeAmount > 0) {
      zapStakeAmountETHValue = lsdEthOracle.consult(lsdEthPair.token1(), zapStakeAmount).mul(PRECISION);
    }

    uint256 ethxAmountETHValue = ICurvePool(ethxPool).get_virtual_price().mul(ethxAmount).div(DECIMALS);
    if (ethxAmountETHValue == 0) {
      return 1 * DECIMALS;
    }

    uint256 boostRate = lpAmountETHValue.add(zapStakeAmountETHValue).mul(DECIMALS).div(ethxAmountETHValue).div(PRECISION);
    return Math.min(boostRate.add(1 * DECIMALS), MAX_BOOST_RATE);
  }

  /*******************************************************/
  /****************** MUTATIVE FUNCTIONS *****************/
  /*******************************************************/

  function stake(uint256 amount) external nonReentrant {
    require(amount > 0, "Amount must be greater than 0");
    require(userStakes[_msgSender()].length < MAX_STAKES_COUNT_PER_USER, "Too many stakes");

    IERC20(address(lsdEthPair)).safeTransferFrom(_msgSender(), address(this), amount);

    StakeInfo memory stakeInfo = StakeInfo(amount, block.timestamp, block.timestamp.add(stakePeriod));
    userStakes[_msgSender()].push(stakeInfo);

    emit Stake(_msgSender(), amount, stakePeriod);

    farm.updateBoostRate(_msgSender());
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

  function zapStake(uint256 amount) external nonReentrant {
    require(amount > 0, "Amount must be greater than 0");
    require(userZapStakes[_msgSender()].length < MAX_STAKES_COUNT_PER_USER, "Too many zap stakes");

    IERC20(address(esLSD)).safeTransferFrom(_msgSender(), address(this), amount);

    ZapStakeInfo memory stakeInfo = ZapStakeInfo(amount, block.timestamp, block.timestamp.add(stakePeriod));
    userZapStakes[_msgSender()].push(stakeInfo);

    emit ZapStake(_msgSender(), amount, stakePeriod);

    farm.updateBoostRate(_msgSender());
  }

  function zapUnstake() external nonReentrant {
    require(esLSD.zapDelegator() == address(this), "Not esLSD zap delegator");

    uint256 unstakeableAmount = 0;
    for (uint256 index = 0; index < userZapStakes[_msgSender()].length; ) {
      ZapStakeInfo storage stakeInfo = userZapStakes[_msgSender()][index];

      if (stakeInfo.amount > 0 && block.timestamp >= stakeInfo.endTime) {
        unstakeableAmount = unstakeableAmount.add(stakeInfo.amount);
        IERC20(address(esLSD)).approve(address(esLSD), stakeInfo.amount);
        esLSD.zapVest(stakeInfo.amount, _msgSender());
        emit ZapUnstake(_msgSender(), stakeInfo.amount);
        _deleteZapStakeInfo(index);
      }
      else {
        index++;
      }
    }

    require(unstakeableAmount > 0, "No zapped tokens to unstake");
    farm.updateBoostRate(_msgSender());
  }

  function tryUpdateOracle() external {
    if (lsdEthOracle.canUpdate()) {
      lsdEthOracle.update();
    }
  }

  /*******************************************************/
  /****************** RESTRICTED FUNCTIONS ***************/
  /*******************************************************/

  function setStakePeriod(uint256 _period) external onlyOwner nonReentrant {
    require(_period >= MIN_STAKE_PERIOD && _period <= MAX_STAKE_PERIOD, "Invalid stake period");
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

  function _deleteZapStakeInfo(uint256 index) internal {
    userZapStakes[_msgSender()][index] = userZapStakes[_msgSender()][userZapStakes[_msgSender()].length - 1];
    userZapStakes[_msgSender()].pop();
  }

  /********************************************/
  /****************** EVENTS ******************/
  /********************************************/

  event UpdateStakePeriod(uint256 previousPeriod, uint256 period);
  event Stake(address indexed userAddress, uint256 amount, uint256 period);
  event Unstake(address indexed userAddress, uint256 amount);
  event ZapStake(address indexed userAddress, uint256 amount, uint256 period);
  event ZapUnstake(address indexed userAddress, uint256 amount);
}