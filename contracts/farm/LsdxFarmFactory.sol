// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import "@openzeppelin/contracts/access/Ownable.sol";

import './LsdxFarm.sol';

contract LsdxFarmFactory is Ownable {
  using SafeMath for uint256;

  // immutables
  address public rewardsToken;

  // the staking tokens for which the rewards contract has been deployed
  address[] public stakingTokens;

  // info about rewards for a particular staking token
  struct FarmInfo {
    address farmAddress;
    uint256 startTime;
    uint256 roundDurationInDays;
    uint256 totalRewardsAmount;
  }

  // rewards info by staking token
  mapping(address => FarmInfo) public farmInfoByStakingToken;

  event FarmDeployed(
    address indexed farmAddress,
    address indexed stakingToken,
    uint256 startTime,
    uint256 roundDurationInDays
  );

  constructor(
    address _rewardsToken
  ) Ownable() {
    rewardsToken = _rewardsToken;
  }

  function getStakingPoolAddress(address stakingToken) public virtual view returns (address) {
    FarmInfo storage info = farmInfoByStakingToken[stakingToken];
    require(info.farmAddress != address(0), 'LsdxFarmFactory::getPoolAddress: not deployed');
    return info.farmAddress;
  }

  function getStakingTokens() public virtual view returns (address[] memory) {
    return stakingTokens;
  }

  ///// permissioned functions

  // deploy a by-stages staking reward contract for the staking token
  function deployPool(address stakingToken, uint256 startTime, uint256 roundDurationInDays) public onlyOwner {
    FarmInfo storage info = farmInfoByStakingToken[stakingToken];

    require(info.farmAddress == address(0), 'LsdxFarmFactory::deployPool: already deployed');
    require(startTime >= block.timestamp, 'LsdxFarmFactory::deployPool: start too soon');
    require(roundDurationInDays > 0, 'LsdxFarmFactory::deployPool: duration too short');

    info.farmAddress = address(new LsdxFarm(/*_rewardsDistribution=*/ address(this), rewardsToken, stakingToken, roundDurationInDays));
    info.startTime = startTime;
    info.roundDurationInDays = roundDurationInDays;
    info.totalRewardsAmount = 0;

    stakingTokens.push(stakingToken);
    emit FarmDeployed(info.farmAddress, stakingToken, startTime, roundDurationInDays);
  }

  function addRewards(address stakingToken, uint256 rewardsAmount) public onlyOwner {
    FarmInfo storage info = farmInfoByStakingToken[stakingToken];
    require(info.farmAddress != address(0), 'LsdxFarmFactory::addRewards: not deployed');
    require(block.timestamp >= info.startTime, 'LsdxFarmFactory::addRewards: not ready');

    if (rewardsAmount > 0) {
      info.totalRewardsAmount = info.totalRewardsAmount.add(rewardsAmount);

      require(
        IERC20(rewardsToken).transferFrom(msg.sender, info.farmAddress, rewardsAmount),
        'LsdxFarmFactory::addRewards: transfer failed'
      );
      LsdxFarm(address(info.farmAddress)).notifyRewardAmount(rewardsAmount);
    }
  }

}