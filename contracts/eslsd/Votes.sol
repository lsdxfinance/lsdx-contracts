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

  mapping(uint256 => uint256) public bribeRewardsPerToken;
  mapping(uint256 => mapping(address => uint256)) public userBribeRewardsPerTokenPaid;
  mapping(uint256 => mapping(address => uint256)) public userBribeRewards;

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
  
  function totalVotes(uint256 poolId) external view onlyValidVotingPool(poolId, false) returns (uint256) {
    return _totalVotes[poolId];
  }

  function userVotes(uint256 poolId, address account) external view onlyValidVotingPool(poolId, false) returns (uint256) {
    return _userVotes[poolId][account];
  }

  function bribeRewardsEarned(uint256 poolId, address account) public view onlyValidVotingPool(poolId, false) returns (uint256) {
    return
      _userVotes[poolId][account]
        .mul(bribeRewardsPerToken[poolId].sub(userBribeRewardsPerTokenPaid[poolId][account]))
        .add(userBribeRewards[poolId][account]);
  }

  /// @dev No guarantees are made on the ordering
  function bribers() public view returns (address[] memory) {
    return _bribersSet.values();
  }

  /* ========== MUTATIVE FUNCTIONS ========== */

  function vote(uint256 poolId, uint256 amount) external virtual payable nonReentrant onlyValidVotingPool(poolId, true) updateBribeAmounts(poolId, _msgSender()) {
    require(amount > 0, "Cannot vote 0");
    _totalVotes[poolId] = _totalVotes[poolId].add(amount);
    _userVotes[poolId][_msgSender()] = _userVotes[poolId][_msgSender()].add(amount);
    IERC20(votingToken).safeTransferFrom(_msgSender(), address(this), amount);
    emit Voted(poolId, _msgSender(), amount);
  }

  function unvote(uint256 poolId, uint256 amount) public virtual nonReentrant onlyValidVotingPool(poolId, false) updateBribeAmounts(poolId, _msgSender()) {
    require(amount > 0, "Cannot unvote 0");
    _totalVotes[poolId] = _totalVotes[poolId].sub(amount);
    _userVotes[poolId][_msgSender()] = _userVotes[poolId][_msgSender()].sub(amount);
    IERC20(votingToken).safeTransfer(_msgSender(), amount);
    emit Unvoted(poolId, _msgSender(), amount);
  }

  function getBribeRewards(uint256 poolId) public nonReentrant onlyValidVotingPool(poolId, false) updateBribeAmounts(poolId, _msgSender()) {
    VotingPool storage pool = _votingPools[poolId];
    uint256 reward = userBribeRewards[poolId][_msgSender()];
    if (reward > 0) {
      userBribeRewards[poolId][_msgSender()] = 0;
      IERC20(pool.bribeToken).safeTransfer(_msgSender(), reward);
      emit BribeRewardsPaid(poolId, _msgSender(), reward);
    }
  }

  function getAllBribeRewards() public nonReentrant updateAllBribeAmounts(_msgSender()) {
    for (uint256 i = 0; i < _votingPoolIds.length(); i++) {
      uint256 poolId = _votingPoolIds.at(i);
      VotingPool storage pool = _votingPools[poolId];
      uint256 reward = userBribeRewards[poolId][_msgSender()];
      if (reward > 0) {
        userBribeRewards[poolId][_msgSender()] = 0;
        IERC20(pool.bribeToken).safeTransfer(_msgSender(), reward);
        emit BribeRewardsPaid(poolId, _msgSender(), reward);
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
    emit VotingPoolDeprecated(poolId, deprecated);
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

  function bribe(uint256 poolId, uint256 bribeAmount) external nonReentrant updateBribeAmounts(poolId, address(0)) onlyValidVotingPool(poolId, true) onlyBriber {
    require(bribeAmount > 0, "Bribe amount should be greater than 0");

    VotingPool storage pool = _votingPools[poolId];
    IERC20(pool.bribeToken).safeTransferFrom(_msgSender(), address(this), bribeAmount);

    if (_totalVotes[poolId] > 0) {
      bribeRewardsPerToken[poolId] = bribeRewardsPerToken[poolId].add(bribeAmount.div(_totalVotes[poolId]));
    }

    emit BribeRewardsAdded(poolId, _msgSender(), bribeAmount);
  }

  /* ========== MODIFIERS ========== */

  modifier onlyBriber() {
    require(_bribersSet.contains(_msgSender()), "Not a briber");
    _;
  }

  modifier onlyValidVotingPool(uint256 poolId, bool active) {
    require(_votingPoolIds.contains(poolId), "Invalid voting pool");
    if (active) {
      require(!_votingPools[poolId].deprecated, "Voting pool deprecated");
    }
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

    if (account != address(0)) {
      userBribeRewards[poolId][account] = bribeRewardsEarned(poolId, account);
      userBribeRewardsPerTokenPaid[poolId][account] = bribeRewardsPerToken[poolId];
    }
  }

  /* ========== EVENTS ========== */
  event Voted(uint256 indexed poolId, address indexed user, uint256 amount);
  event Unvoted(uint256 indexed poolId, address indexed user, uint256 amount);
  event BribeRewardsPaid(uint256 indexed poolId, address indexed user, uint256 reward);
  event BribeRewardsAdded(uint256 indexed poolId, address indexed briber, uint256 bribeAmount);
  event VotingPoolAdded(uint256 indexed poolId, string name, address bribeToken);
  event VotingPoolDeprecated(uint256 indexed poolId, bool deprecated);
  event BriberAdded(address indexed briber);
  event BriberRemoved(address indexed rewarder);
}