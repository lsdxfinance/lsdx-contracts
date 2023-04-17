// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import './LsdxFarm.sol';

contract LsdxFarmFactory is Ownable, ReentrancyGuard {
  using SafeMath for uint256;
  using EnumerableSet for EnumerableSet.AddressSet;

  // immutables
  address public rewardsToken;

  // the staking tokens for which the rewards contract has been deployed
  address[] public stakingTokens;

  // info about rewards for a particular staking token
  struct FarmInfo {
    address farmAddress;
    uint256 totalRewardsAmount;
  }

  // rewards info by staking token
  mapping(address => FarmInfo) public farmInfoByStakingToken;

  EnumerableSet.AddressSet private _rewardersSet;

  constructor(
    address _rewardsToken
  ) Ownable() {
    rewardsToken = _rewardsToken;
    addRewarder(_msgSender());
  }

  function getFarmAddress(address stakingToken) public virtual view returns (address) {
    FarmInfo storage info = farmInfoByStakingToken[stakingToken];
    require(info.farmAddress != address(0), 'LsdxFarmFactory::getFarmAddress: not deployed');
    return info.farmAddress;
  }

  function getStakingTokens() public virtual view returns (address[] memory) {
    return stakingTokens;
  }

  /// @dev No guarantees are made on the ordering
  function getRewarders() public view returns (address[] memory) {
    return _rewardersSet.values();
  }

  ///// permissioned functions

  // deploy a by-stages staking reward contract for the staking token
  function deployFarm(address stakingToken) public onlyOwner {
    FarmInfo storage info = farmInfoByStakingToken[stakingToken];

    require(info.farmAddress == address(0), 'LsdxFarmFactory::deployFarm: already deployed');

    info.farmAddress = address(new LsdxFarm(/*_rewardsDistribution=*/ address(this), rewardsToken, stakingToken));
    info.totalRewardsAmount = 0;

    stakingTokens.push(stakingToken);
    emit FarmDeployed(info.farmAddress, stakingToken);
  }

  function addRewards(address stakingToken, uint256 rewardsAmount, uint256 roundDurationInDays) public onlyRewarder {
    FarmInfo storage info = farmInfoByStakingToken[stakingToken];
    require(info.farmAddress != address(0), 'LsdxFarmFactory::addRewards: not deployed');
    require(roundDurationInDays > 0, 'LsdxFarmFactory::addRewards: duration too short');

    if (rewardsAmount > 0) {
      info.totalRewardsAmount = info.totalRewardsAmount.add(rewardsAmount);

      require(
        IERC20(rewardsToken).transferFrom(msg.sender, info.farmAddress, rewardsAmount),
        'LsdxFarmFactory::addRewards: transfer failed'
      );
      LsdxFarm(address(info.farmAddress)).notifyRewardAmount(rewardsAmount, roundDurationInDays);
    }
  }

  function addRewarder(address rewarder) public nonReentrant onlyOwner {
    require(rewarder != address(0), "Zero address detected");
    require(!_rewardersSet.contains(rewarder), "Already added");

    _rewardersSet.add(rewarder);
    emit RewarderAdded(rewarder);
  }

  function removeRewarder(address rewarder) public nonReentrant onlyOwner {
    require(_rewardersSet.contains(rewarder), "Not a rewarder");
    require(_rewardersSet.remove(rewarder), "Failed to remove rewarder");
    emit RewarderRemoved(rewarder);
  }

  modifier onlyRewarder() {
    require(_rewardersSet.contains(_msgSender()), "Not a rewarder");
    _;
  }

  event FarmDeployed(address indexed farmAddress, address indexed stakingToken);
  event RewarderAdded(address indexed rewarder);
  event RewarderRemoved(address indexed rewarder);
}