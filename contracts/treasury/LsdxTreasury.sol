// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract LsdxTreasury is Ownable, ReentrancyGuard {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  /* ========== STATE VARIABLES ========== */

  mapping(address => IERC20) public rewardsTokens;
  address[] public rewardTokensList;
  IERC20 public stakingToken;
  uint256 public periodFinish = 0;
  mapping(address => uint256) public rewardRates;
  mapping(address => uint256) public rewardsDurations;
  uint256 public lastUpdateTime;
  mapping(address => uint256) public rewardPerTokenStored;

  mapping(address => mapping(address => uint256)) public userRewardPerTokenPaid;
  mapping(address => mapping(address => uint256)) public rewards;

  uint256 internal _totalSupply;
  mapping(address => uint256) private _balances;

  /* ========== CONSTRUCTOR ========== */

  constructor(
    address[] memory _rewardsTokens,
    address _stakingToken
  ) Ownable() {
    for (uint256 i = 0; i < _rewardsTokens.length; i++) {
      rewardsTokens[_rewardsTokens[i]] = IERC20(_rewardsTokens[i]);
      rewardTokensList.push(_rewardsTokens[i]);
    }
    stakingToken = IERC20(_stakingToken);
  }

  /* ========== VIEWS ========== */

  function totalSupply() external view returns (uint256) {
    return _totalSupply;
  }

  function balanceOf(address account) external view returns (uint256) {
    return _balances[account];
  }

  function lastTimeRewardApplicable() public view returns (uint256) {
    return Math.min(block.timestamp, periodFinish);
  }

  function rewardPerToken(address rewardToken) public view returns (uint256) {
    if (_totalSupply == 0) {
      return rewardPerTokenStored[rewardToken];
    }
    return
      rewardPerTokenStored[rewardToken].add(
        lastTimeRewardApplicable()
          .sub(lastUpdateTime)
          .mul(rewardRates[rewardToken])
          .mul(1e18)
        .div(_totalSupply)
      );
  }

  function earned(address account, address rewardToken) public view returns (uint256) {
    require(isSupportedRewardToken(rewardToken), "Reward token not supported");
    return
      _balances[account]
        .mul(rewardPerToken(rewardToken).sub(userRewardPerTokenPaid[account][rewardToken]))
        .div(1e18)
        .add(rewards[account][rewardToken]);
  }

  function isSupportedRewardToken(address rewardToken) public view returns (bool) {
    for (uint256 i = 0; i < rewardTokensList.length; i++) {
      if (rewardTokensList[i] == rewardToken) {
        return true;
      }
    }
    return false;
  }


  /* ========== MUTATIVE FUNCTIONS ========== */

  function stake(uint256 amount) external nonReentrant updateReward(msg.sender) {
    require(amount > 0, "Cannot stake 0");
    _totalSupply = _totalSupply.add(amount);
    _balances[msg.sender] = _balances[msg.sender].add(amount);
    stakingToken.safeTransferFrom(msg.sender, address(this), amount);
    emit Staked(msg.sender, amount);
  }

  function withdraw(uint256 amount) public nonReentrant updateReward(msg.sender) {
    require(amount > 0, "Cannot withdraw 0");
    _totalSupply = _totalSupply.sub(amount);
    _balances[msg.sender] = _balances[msg.sender].sub(amount);
    stakingToken.safeTransfer(msg.sender, amount);
    emit Withdrawn(msg.sender, amount);
  }

  function getReward() public nonReentrant updateReward(msg.sender) {
    for (uint256 i = 0; i < rewardTokensList.length; i++) {
      address currentToken = rewardTokensList[i];
      uint256 reward = rewards[msg.sender][currentToken];
      if (reward > 0) {
        rewards[msg.sender][currentToken] = 0;
        IERC20(currentToken).safeTransfer(msg.sender, reward);
        emit RewardPaid(msg.sender, currentToken, reward);
      }
    }
  }

  function exit() external {
    withdraw(_balances[msg.sender]);
    getReward();
  }

  /* ========== RESTRICTED FUNCTIONS ========== */

  function addRewards(address rewardToken, uint256 rewardAmount, uint256 durationInDays) external onlyOwner {
    require(rewardAmount > 0, "Reward amount should be greater than 0");
    require(isSupportedRewardToken(rewardToken), "Reward token not supported");
    uint256 rewardsDuration = durationInDays.mul(3600 * 24);
    IERC20(rewardToken).safeTransferFrom(msg.sender, address(this), rewardAmount);
    notifyRewardAmount(rewardToken, rewardAmount, rewardsDuration);
  }

  function notifyRewardAmount(address rewardToken, uint256 reward, uint256 rewardsDuration) internal virtual onlyOwner updateReward(address(0)) {
    if (block.timestamp >= periodFinish) {
      rewardRates[rewardToken] = reward.div(rewardsDuration);
    } else {
      uint256 remaining = periodFinish.sub(block.timestamp);
      uint256 leftover = remaining.mul(rewardRates[rewardToken]);
      rewardRates[rewardToken] = reward.add(leftover).div(rewardsDuration);
    }

    uint balance = IERC20(rewardToken).balanceOf(address(this));
    require(rewardRates[rewardToken] <= balance.div(rewardsDuration), "Provided reward too high");

    lastUpdateTime = block.timestamp;
    periodFinish = block.timestamp.add(rewardsDuration);
    emit RewardAdded(rewardToken, reward);
  }

  /* ========== MODIFIERS ========== */

  modifier updateReward(address account) {
    for (uint256 i = 0; i < rewardTokensList.length; i++) {
      address currentToken = rewardTokensList[i];
      rewardPerTokenStored[currentToken] = rewardPerToken(currentToken);
      lastUpdateTime = lastTimeRewardApplicable();
      if (account != address(0)) {
        rewards[account][currentToken] = earned(account, currentToken);
        userRewardPerTokenPaid[account][currentToken] = rewardPerTokenStored[currentToken];
      }
    }
    _;
  }

  /* ========== EVENTS ========== */

  event RewardAdded(address indexed rewardToken, uint256 reward);
  event Staked(address indexed user, uint256 amount);
  event Withdrawn(address indexed user, uint256 amount);
  event RewardPaid(address indexed user, address indexed rewardToken, uint256 reward);
}