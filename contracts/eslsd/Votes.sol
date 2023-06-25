// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/structs/DoubleEndedQueue.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "./esLSD.sol";

contract Votes is Ownable, ReentrancyGuard {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;
  using Counters for Counters.Counter;
  using DoubleEndedQueue for DoubleEndedQueue.Bytes32Deque;
  using EnumerableSet for EnumerableSet.AddressSet;
  using EnumerableSet for EnumerableSet.UintSet;

  /* ========== STATE VARIABLES ========== */

  uint256 constant flashRewardDuration = 1 seconds;

  address public votingToken;

  Counters.Counter private _nextVotingPoolId;
  EnumerableSet.UintSet private _votingPoolIds;
  mapping(uint256 => VotingPool) private _votingPools;
  struct VotingPool {
    uint256 id;
    bool deprecated;
    string name;
    address bribeToken;
  }

  mapping(uint256 => uint256) private _totalVotes;
  mapping(uint256 => mapping(address => uint256)) private _userVotes;

  EnumerableSet.AddressSet private _bribersSet;

  mapping(uint256 => uint256) public periodFinish;
  mapping(uint256 => uint256) public bribeRates;
  mapping(uint256 => uint256) public bribesPerTokenStored;
  mapping(uint256 => uint256) public lastUpdateTime;
  mapping(uint256 => mapping(address => uint256)) public userBribesPerTokenPaid;

  mapping(uint256 => mapping(address => uint256)) public bribes;

  /* ========== CONSTRUCTOR ========== */

  constructor(
    address _votingToken
  ) Ownable() {
    require(_votingToken != address(0), "Zero address detected");
    votingToken = _votingToken;
    addBriber(_msgSender());
  }

  /* ========== VIEWS ========== */

  function getVotingPools(bool activeOnly) public view returns (VotingPool[] memory) {
    uint256 count = 0;
    for (uint256 i = 0; i < _votingPoolIds.length(); i++) {
      uint256 poolId = _votingPoolIds.at(i);
      VotingPool storage pool = _votingPools[poolId];
      if (!activeOnly || !pool.deprecated) {
        count++;
      }
    }

    VotingPool[] memory pools = new VotingPool[](count);
    uint256 index = 0;
    for (uint256 i = 0; i < _votingPoolIds.length(); i++) {
      uint256 poolId = _votingPoolIds.at(i);
      VotingPool storage pool = _votingPools[poolId];
      if (!activeOnly || !pool.deprecated) {
        pools[index] = pool;
        index++;
      }
    }
    return pools;
  }
  
  function totalVotes(uint256 poolId) external view onlyValidVotingPool(poolId) returns (uint256) {
    return _totalVotes[poolId];
  }

  function votesOf(uint256 poolId, address account) external view onlyValidVotingPool(poolId) returns (uint256) {
    return _userVotes[poolId][account];
  }

  function lastTimeBribesApplicable(uint256 poolId) public view onlyValidVotingPool(poolId) returns (uint256) {
    return Math.min(block.timestamp, periodFinish[poolId]);
  }

  function bribesPerToken(uint256 poolId) public view onlyValidVotingPool(poolId) returns (uint256) {
    if (_totalVotes[poolId] == 0) {
      return bribesPerTokenStored[poolId];
    }
    return
      bribesPerTokenStored[poolId].add(
        lastTimeBribesApplicable(poolId)
          .sub(lastUpdateTime[poolId])
          .mul(bribeRates[poolId])
          .mul(1e18)
        .div(_totalVotes[poolId])
      );
  }

  function earned(uint256 poolId, address account) public view onlyValidVotingPool(poolId) returns (uint256) {
    return
      _userVotes[poolId][account]
        .mul(bribesPerToken(poolId).sub(userBribesPerTokenPaid[poolId][account]))
        .div(1e18)
        .add(bribes[poolId][account]);
  }

  /// @dev No guarantees are made on the ordering
  function bribers() public view returns (address[] memory) {
    return _bribersSet.values();
  }


  /* ========== MUTATIVE FUNCTIONS ========== */

  function vote(uint256 poolId, uint256 amount) external virtual payable nonReentrant onlyValidVotingPool(poolId) updateBribeAmounts(poolId, _msgSender()) {
    require(amount > 0, "Cannot stake 0");
    _totalVotes[poolId] = _totalVotes[poolId].add(amount);
    _userVotes[poolId][_msgSender()] = _userVotes[poolId][_msgSender()].add(amount);
    IERC20(votingToken).safeTransferFrom(_msgSender(), address(this), amount);
    emit Voted(poolId, _msgSender(), amount);
  }

  function withdraw(uint256 poolId, uint256 amount) public virtual nonReentrant onlyValidVotingPool(poolId) updateBribeAmounts(poolId, _msgSender()) {
    require(amount > 0, "Cannot withdraw 0");
    _totalVotes[poolId] = _totalVotes[poolId].sub(amount);
    _userVotes[poolId][_msgSender()] = _userVotes[poolId][_msgSender()].sub(amount);
    IERC20(votingToken).safeTransfer(_msgSender(), amount);
    emit Withdrawn(poolId, _msgSender(), amount);
  }

  function getBribes() public nonReentrant updateAllBribeAmounts(_msgSender()) {
    for (uint256 i = 0; i < _votingPoolIds.length(); i++) {
      uint256 poolId = _votingPoolIds.at(i);
      VotingPool storage pool = _votingPools[poolId];
      // Update deprecated pools as well
      uint256 reward = bribes[poolId][_msgSender()];
      if (reward > 0) {
        bribes[poolId][_msgSender()] = 0;
        IERC20(pool.bribeToken).safeTransfer(_msgSender(), reward);
        emit BribePaid(poolId, _msgSender(), reward);
      }
    }
  }

  /* ========== RESTRICTED FUNCTIONS ========== */

  function addVotingPool(string memory name, address bribeToken) external nonReentrant onlyOwner {
    require(bribeToken != address(0), "Zero address detected");

    _nextVotingPoolId.increment();
    uint256 poolId = _nextVotingPoolId.current();

    VotingPool memory pool = VotingPool({
      id: poolId,
      deprecated: false,
      name: name,
      bribeToken: bribeToken
    });
    _votingPools[poolId] = pool;
    _votingPoolIds.add(poolId);
    emit VotingPoolAdded(pool.id, pool.name, pool.bribeToken);
  }

  function deprecateVotingPool(uint256 poolId, bool deprecated) external nonReentrant onlyOwner {
    require(_votingPoolIds.contains(poolId), "Invalid pool id");

    VotingPool storage pool = _votingPools[poolId];
    require(pool.deprecated != deprecated, "Same deprecate status");
    pool.deprecated = deprecated;
    emit VotingPoolDeprecated(pool.id, deprecated);
  }

  function addBriber(address briber) public nonReentrant onlyOwner {
    require(briber != address(0), "Zero address detected");
    require(!_bribersSet.contains(briber), "Already added");

    _bribersSet.add(briber);
    emit BriberAdded(briber);
  }

  function removeBriber(address briber) public nonReentrant onlyOwner {
    require(_bribersSet.contains(briber), "Not a briber");
    require(_bribersSet.remove(briber), "Failed to remove briber");
    emit BriberRemoved(briber);
  }

  function bribe(uint256 poolId, uint256 bribeAmount) external nonReentrant onlyValidVotingPool(poolId) onlyBriber {
    require(bribeAmount > 0, "Bribe amount should be greater than 0");

    VotingPool storage pool = _votingPools[poolId];
    IERC20(pool.bribeToken).safeTransferFrom(_msgSender(), address(this), bribeAmount);
    _notifyBribeAmount(poolId, bribeAmount, flashRewardDuration);
  }

  function _notifyBribeAmount(uint256 poolId, uint256 bribeAmount, uint256 rewardDuration) internal virtual onlyBriber updateBribeAmounts(poolId, address(0)) {
    if (block.timestamp >= periodFinish[poolId]) {
      bribeRates[poolId] = bribeAmount.div(rewardDuration);
    }
    else {
      uint256 remaining = periodFinish[poolId].sub(block.timestamp);
      uint256 leftover = remaining.mul(bribeRates[poolId]);
      bribeRates[poolId] = bribeAmount.add(leftover).div(rewardDuration);
    }

    VotingPool storage pool = _votingPools[poolId];
    uint balance = IERC20(pool.bribeToken).balanceOf(address(this));
    require(bribeRates[poolId] <= balance.div(rewardDuration), "Provided bribe too high");

    lastUpdateTime[poolId] = block.timestamp;
    periodFinish[poolId] = block.timestamp.add(rewardDuration);
    emit BribeAdded(poolId, _msgSender(), bribeAmount);
  }

  /* ========== MODIFIERS ========== */

  modifier onlyBriber() {
    require(_bribersSet.contains(_msgSender()), "Not a briber");
    _;
  }

  modifier onlyValidVotingPool(uint256 poolId) {
    require(_votingPoolIds.contains(poolId), "Invalid voting pool");
    _;
  }

  modifier updateBribeAmounts(uint256 poolId, address account) {
    _updateBribeAmounts(poolId, account);
    _;
  }

  modifier updateAllBribeAmounts(address account) {
    for (uint256 i = 0; i < _votingPoolIds.length(); i++) {
      uint256 poolId = _votingPoolIds.at(i);
      // Update deprecated pools as well
      _updateBribeAmounts(poolId, account);
    }
    _;
  }

  function _updateBribeAmounts(uint256 poolId, address account) internal {
    require(_votingPoolIds.contains(poolId), "Invalid voting pool");

    bribesPerTokenStored[poolId] = bribesPerToken(poolId);
    lastUpdateTime[poolId] = lastTimeBribesApplicable(poolId);
    if (account != address(0)) {
      bribes[poolId][account] = earned(poolId, account);
      userBribesPerTokenPaid[poolId][account] = bribesPerTokenStored[poolId];
    }
  }

  /* ========== EVENTS ========== */
  event Voted(uint256 indexed poolId, address indexed user, uint256 amount);
  event Withdrawn(uint256 indexed poolId, address indexed user, uint256 amount);
  event BribePaid(uint256 indexed poolId, address indexed user, uint256 reward);
  event BribeAdded(uint256 indexed poolId, address indexed briber, uint256 bribeAmount);
  event VotingPoolAdded(uint256 indexed poolId, string name, address bribeToken);
  event VotingPoolDeprecated(uint256 indexed poolId, bool deprecated);
  event BriberAdded(address indexed briber);
  event BriberRemoved(address indexed rewarder);
}