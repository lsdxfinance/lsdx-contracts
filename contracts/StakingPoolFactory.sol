// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import "@openzeppelin/contracts/access/Ownable.sol";

import './StakingPool.sol';

contract StakingPoolFactory is Ownable {
  using SafeMath for uint;

  // immutables
  address public rewardsToken;
  // uint public stakingRewardsGenesis;

  // the staking tokens for which the rewards contract has been deployed
  // address[] public stakingTokens;

  // info about rewards for a particular staking token
  struct StakingPoolInfo {
    address stakingPoolAddress;
    uint totalRewardsAmount;
  }

  // rewards info by staking token
  mapping(address => StakingPoolInfo) public stakingPoolInfoByStakingToken;

  constructor(
    address _rewardsToken
    // uint _stakingRewardsGenesis
  ) Ownable() {
    // require(_stakingRewardsGenesis >= block.timestamp, 'StakingRewardsFactory::constructor: genesis too soon');

    rewardsToken = _rewardsToken;
    // stakingRewardsGenesis = _stakingRewardsGenesis;
  }

  ///// permissioned functions

  // deploy a staking reward contract for the staking token, and store the reward amount
  // the reward will be distributed to the staking reward contract no sooner than the genesis
  function deploy(address stakingToken) public onlyOwner {
    StakingPoolInfo storage info = stakingPoolInfoByStakingToken[stakingToken];
    require(info.stakingPoolAddress == address(0), 'StakingPoolFactory::deploy: already deployed');

    info.stakingPoolAddress = address(new StakingPool(/*_rewardsDistribution=*/ address(this), rewardsToken, stakingToken));
    info.totalRewardsAmount = 0;
    // stakingTokens.push(stakingToken);
  }

  ///// permissionless functions

  // call notifyRewardAmount for all staking tokens.
  // function notifyRewardAmounts(uint rewardAmount) public {
  //   require(stakingTokens.length > 0, 'StakingRewardsFactory::notifyRewardAmounts: called before any deploys');
  //   for (uint i = 0; i < stakingTokens.length; i++) {
  //     notifyRewardAmount(stakingTokens[i], rewardAmount);
  //   }
  // }

  // notify reward amount for an individual staking token.
  // this is a fallback in case the notifyRewardAmounts costs too much gas to call for all contracts
  function notifyRewardAmount(address stakingToken, uint rewardAmount) public {
    // require(block.timestamp >= stakingRewardsGenesis, 'StakingRewardsFactory::notifyRewardAmount: not ready');

    StakingPoolInfo storage info = stakingPoolInfoByStakingToken[stakingToken];
    require(info.stakingPoolAddress != address(0), 'StakingPoolFactory::notifyRewardAmount: not deployed');

    if (rewardAmount > 0) {
      info.totalRewardsAmount = info.totalRewardsAmount.add(rewardAmount);

      require(
        IERC20(rewardsToken).transfer(info.stakingPoolAddress, rewardAmount),
        'StakingPoolFactory::notifyRewardAmount: transfer failed'
      );
      StakingPool(info.stakingPoolAddress).notifyRewardAmount(rewardAmount);
    }
  }
}