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
    uint256 totalRewardsAmount;
  }

  // rewards info by staking token
  mapping(address => FarmInfo) public farmInfoByStakingToken;

  event FarmDeployed(
    address indexed farmAddress,
    address indexed stakingToken
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
  function deployPool(address stakingToken) public onlyOwner {
    FarmInfo storage info = farmInfoByStakingToken[stakingToken];

    require(info.farmAddress == address(0), 'LsdxFarmFactory::deployPool: already deployed');

    info.farmAddress = address(new LsdxFarm(/*_rewardsDistribution=*/ address(this), rewardsToken, stakingToken));
    info.totalRewardsAmount = 0;

    stakingTokens.push(stakingToken);
    emit FarmDeployed(info.farmAddress, stakingToken);
  }

  function addRewards(address stakingToken, uint256 rewardsAmount, uint256 roundDurationInDays) public onlyOwner {
    FarmInfo storage info = farmInfoByStakingToken[stakingToken];
    require(info.farmAddress != address(0), 'LsdxFarmFactory::addRewards: not deployed');
    require(roundDurationInDays > 0, 'LsdxFarmFactory::deployPool: duration too short');

    if (rewardsAmount > 0) {
      info.totalRewardsAmount = info.totalRewardsAmount.add(rewardsAmount);

      require(
        IERC20(rewardsToken).transferFrom(msg.sender, info.farmAddress, rewardsAmount),
        'LsdxFarmFactory::addRewards: transfer failed'
      );
      LsdxFarm(address(info.farmAddress)).notifyRewardAmount(rewardsAmount, roundDurationInDays);
    }
  }

}