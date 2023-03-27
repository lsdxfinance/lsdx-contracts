// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract LsdxTreasury is Ownable, ReentrancyGuard {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;
  using EnumerableSet for EnumerableSet.AddressSet;

  /* ========== STATE VARIABLES ========== */

  IERC20 public stakingToken;
  EnumerableSet.AddressSet internal rewardTokensSet;
  EnumerableSet.AddressSet internal rewardersSet;

  mapping(address => uint256) public periodFinish;
  mapping(address => uint256) public rewardRates;
  mapping(address => uint256) public rewardsPerTokenStored;
  mapping(address => uint256) public lastUpdateTime;

  mapping(address => mapping(address => uint256)) public userRewardsPerTokenPaid;
  mapping(address => mapping(address => uint256)) public rewards;

  uint256 internal _totalSupply;
  mapping(address => uint256) private _balances;

  /* ========== CONSTRUCTOR ========== */

  constructor(
    address _stakingToken,
    address[] memory _rewardTokens
  ) Ownable() {
    require(_stakingToken != address(0), "Zero address detected");
    require(_rewardTokens.length > 0, "Empty reward token list");

    stakingToken = IERC20(_stakingToken);
    for (uint256 i = 0; i < _rewardTokens.length; i++) {
      addRewardToken(_rewardTokens[i]);
    }
    addRewarder(_msgSender());
  }

  /* ========== VIEWS ========== */

  function totalSupply() external view returns (uint256) {
    return _totalSupply;
  }

  function balanceOf(address account) external view returns (uint256) {
    return _balances[account];
  }

  function lastTimeRewardsApplicable(address rewardToken) public view onlyValidRewardToken(rewardToken) returns (uint256) {
    return Math.min(block.timestamp, periodFinish[rewardToken]);
  }

  function rewardsPerToken(address rewardToken) public view onlyValidRewardToken(rewardToken) returns (uint256) {
    if (_totalSupply == 0) {
      return rewardsPerTokenStored[rewardToken];
    }
    return
      rewardsPerTokenStored[rewardToken].add(
        lastTimeRewardsApplicable(rewardToken)
          .sub(lastUpdateTime[rewardToken])
          .mul(rewardRates[rewardToken])
          .mul(1e18)
        .div(_totalSupply)
      );
  }

  function earned(address account, address rewardToken) public view onlyValidRewardToken(rewardToken) returns (uint256) {
    return
      _balances[account]
        .mul(rewardsPerToken(rewardToken).sub(userRewardsPerTokenPaid[account][rewardToken]))
        .div(1e18)
        .add(rewards[account][rewardToken]);
  }

  function isSupportedRewardToken(address rewardToken) public view returns (bool) {
    return rewardTokensSet.contains(rewardToken);
  }

  // @dev No guarantees are made on the ordering
  function rewardTokens() public view returns (address[] memory) {
    return rewardTokensSet.values();
  }

  // @dev No guarantees are made on the ordering
  function rewarders() public view returns (address[] memory) {
    return rewardersSet.values();
  }

  /* ========== MUTATIVE FUNCTIONS ========== */

  function stake(uint256 amount) external nonReentrant updateAllRewards(msg.sender) {
    require(amount > 0, "Cannot stake 0");
    _totalSupply = _totalSupply.add(amount);
    _balances[msg.sender] = _balances[msg.sender].add(amount);
    stakingToken.safeTransferFrom(msg.sender, address(this), amount);
    emit Staked(msg.sender, amount);
  }

  function withdraw(uint256 amount) public nonReentrant updateAllRewards(msg.sender) {
    require(amount > 0, "Cannot withdraw 0");
    _totalSupply = _totalSupply.sub(amount);
    _balances[msg.sender] = _balances[msg.sender].sub(amount);
    stakingToken.safeTransfer(msg.sender, amount);
    emit Withdrawn(msg.sender, amount);
  }

  function getRewards() public nonReentrant updateAllRewards(msg.sender) {
    for (uint256 i = 0; i < rewardTokensSet.length(); i++) {
      address currentToken = rewardTokensSet.at(i);
      uint256 reward = rewards[msg.sender][currentToken];
      if (reward > 0) {
        rewards[msg.sender][currentToken] = 0;
        IERC20(currentToken).safeTransfer(msg.sender, reward);
        emit RewardsPaid(msg.sender, currentToken, reward);
      }
    }
  }

  function exit() external {
    withdraw(_balances[msg.sender]);
    getRewards();
  }

  /* ========== RESTRICTED FUNCTIONS ========== */

  function addRewarder(address rewarder) public onlyOwner {
    require(rewarder != address(0), "Zero address detected");
    require(!rewardersSet.contains(rewarder), "Already added");

    rewardersSet.add(rewarder);
    emit RewarderAdded(rewarder);
  }

  function removeRewarder(address rewarder) public onlyOwner {
    require(rewardersSet.contains(rewarder), "Not a rewarder");
    require(rewardersSet.remove(rewarder), "Failed to remove rewarder");
    emit RewarderRemoved(rewarder);
  }

  function addRewardToken(address rewardToken) public onlyOwner {
    require(rewardToken != address(0), "Zero address detected");
    require(!rewardTokensSet.contains(rewardToken), "Already supported");
    rewardTokensSet.add(rewardToken);
    emit RewardTokenAdded(rewardToken);
  }

  function addRewards(address rewardToken, uint256 rewardAmount, uint256 durationInDays) external onlyValidRewardToken(rewardToken) onlyRewarder {
    require(rewardAmount > 0, "Reward amount should be greater than 0");
    uint256 rewardDuration = durationInDays.mul(3600 * 24);
    IERC20(rewardToken).safeTransferFrom(msg.sender, address(this), rewardAmount);
    notifyRewardsAmount(rewardToken, rewardAmount, rewardDuration);
  }

  function notifyRewardsAmount(address rewardToken, uint256 reward, uint256 rewardDuration) internal virtual onlyRewarder updateRewards(address(0), rewardToken) {
    if (block.timestamp >= periodFinish[rewardToken]) {
      rewardRates[rewardToken] = reward.div(rewardDuration);
    }
    else {
      uint256 remaining = periodFinish[rewardToken].sub(block.timestamp);
      uint256 leftover = remaining.mul(rewardRates[rewardToken]);
      rewardRates[rewardToken] = reward.add(leftover).div(rewardDuration);
    }

    uint balance = IERC20(rewardToken).balanceOf(address(this));
    require(rewardRates[rewardToken] <= balance.div(rewardDuration), "Provided reward too high");

    lastUpdateTime[rewardToken] = block.timestamp;
    periodFinish[rewardToken] = block.timestamp.add(rewardDuration);
    emit RewardsAdded(rewardToken, reward, rewardDuration);
  }

  /* ========== MODIFIERS ========== */

  modifier onlyRewarder() {
    require(rewardersSet.contains(_msgSender()), "");
    _;
  }

  modifier onlyValidRewardToken(address rewardToken) {
    require(isSupportedRewardToken(rewardToken), "Reward token not supported");
    _;
  }

  modifier updateRewards(address account, address rewardToken) {
    _updateRewards(account, rewardToken);
    _;
  }

  modifier updateAllRewards(address account) {
    for (uint256 i = 0; i < rewardTokensSet.length(); i++) {
      address rewardToken = rewardTokensSet.at(i);
      _updateRewards(account, rewardToken);
    }
    _;
  }

  function _updateRewards(address account, address rewardToken) internal {
    require(isSupportedRewardToken(rewardToken), "Reward token not supported");
    rewardsPerTokenStored[rewardToken] = rewardsPerToken(rewardToken);
    lastUpdateTime[rewardToken] = lastTimeRewardsApplicable(rewardToken);
    if (account != address(0)) {
      rewards[account][rewardToken] = earned(account, rewardToken);
      userRewardsPerTokenPaid[account][rewardToken] = rewardsPerTokenStored[rewardToken];
    }
  }

  /* ========== EVENTS ========== */

  event Staked(address indexed user, uint256 amount);
  event Withdrawn(address indexed user, uint256 amount);
  event RewardsPaid(address indexed user, address indexed rewardToken, uint256 reward);
  event RewardTokenAdded(address indexed rewardToken);
  event RewardsAdded(address indexed rewardToken, uint256 reward, uint256 rewardDuration);
  event RewarderAdded(address indexed rewarder);
  event RewarderRemoved(address indexed rewarder);
}