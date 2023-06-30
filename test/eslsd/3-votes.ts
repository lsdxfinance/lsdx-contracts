import _ from 'lodash';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ONE_DAY_IN_SECS, deployLsdxV2ContractsFixture, expectBigNumberEquals } from '../utils';
import { BigNumber } from 'ethers';

describe('Votes', () => {

  it('Voting pools management works', async () => {

    const { lsdCoin, esLSD, ethx, votes, Alice, Bob } = await loadFixture(deployLsdxV2ContractsFixture);

    expect(await votes.getAllVotingPools(false)).lengthOf(0);

    // Create 3 voting pools with bribe token:  $ETHx, $LSD, $ETHx (again)
    await expect(votes.connect(Bob).addVotingPool("ETHx Voting Pool", ethx.address)).to.be.rejectedWith(/Ownable: caller is not the owner/);
    let nextPoolId = 1;
    await expect(votes.connect(Alice).addVotingPool("ETHx Voting Pool", ethx.address))
      .to.emit(votes, 'VotingPoolAdded').withArgs(nextPoolId, "ETHx Voting Pool", ethx.address);

    nextPoolId++;
    await expect(votes.connect(Alice).addVotingPool("LSD Voting Pool", lsdCoin.address))
      .to.emit(votes, 'VotingPoolAdded').withArgs(nextPoolId, "LSD Voting Pool", lsdCoin.address);

    nextPoolId++;
    await expect(votes.connect(Alice).addVotingPool("ETHx Voting Pool", ethx.address))
      .to.emit(votes, 'VotingPoolAdded').withArgs(nextPoolId, "ETHx Voting Pool", ethx.address);

    // Check voting pools
    expect(await votes.getAllVotingPools(false)).lengthOf(3);

    let pool1 = await votes.getVotingPool(1);
    expect(pool1.id).to.equal(1);
    expect(pool1.deprecated).to.equal(false);
    expect(pool1.name).to.equal("ETHx Voting Pool");
    expect(pool1.bribeToken).to.equal(ethx.address);

    const pool2 = await votes.getVotingPool(2);
    expect(pool2.id).to.equal(2);
    expect(pool2.deprecated).to.equal(false);
    expect(pool2.name).to.equal("LSD Voting Pool");
    expect(pool2.bribeToken).to.equal(lsdCoin.address);

    const pool3 = await votes.getVotingPool(3);
    expect(pool3.id).to.equal(3);
    expect(pool3.deprecated).to.equal(false);
    expect(pool3.name).to.equal("ETHx Voting Pool");
    expect(pool3.bribeToken).to.equal(ethx.address);

    // Deprecate pool 1
    await expect(votes.connect(Bob).deprecateVotingPool(1, true)).to.be.rejectedWith(/Ownable: caller is not the owner/);
    await expect(votes.connect(Alice).deprecateVotingPool(1, true))
      .to.emit(votes, 'VotingPoolDeprecated').withArgs(1, true);
    
    expect(await votes.getAllVotingPools(false)).lengthOf(3);
    expect(await votes.getAllVotingPools(true)).lengthOf(2);

    pool1 = await votes.getVotingPool(1);
    expect(pool1.deprecated).to.equal(true);

    // Activate pool 1
    await expect(votes.connect(Alice).deprecateVotingPool(1, false))
      .to.emit(votes, 'VotingPoolDeprecated').withArgs(1, false);
  
    expect(await votes.getAllVotingPools(false)).lengthOf(3);
    expect(await votes.getAllVotingPools(true)).lengthOf(3);

    pool1 = await votes.getVotingPool(1);
    expect(pool1.deprecated).to.equal(false);
  });

  it('E2E scenario works', async () => {

    const { lsdCoin, esLSD, ethx, votes, Alice, Bob, Caro } = await loadFixture(deployLsdxV2ContractsFixture);

    const genesisTime = await time.latest();

    // Create 2 voting pools with bribe token:  $ETHx, $LSD
    await expect(votes.connect(Bob).addVotingPool("ETHx Voting Pool", ethx.address)).to.be.rejectedWith(/Ownable: caller is not the owner/);
    const ethxPoolId = 1;
    await expect(votes.connect(Alice).addVotingPool("ETHx Voting Pool", ethx.address))
      .to.emit(votes, 'VotingPoolAdded').withArgs(ethxPoolId, "ETHx Voting Pool", ethx.address);

    const lsdPoolId = 2;
    await expect(votes.connect(Alice).addVotingPool("LSD Voting Pool", lsdCoin.address))
      .to.emit(votes, 'VotingPoolAdded').withArgs(lsdPoolId, "LSD Voting Pool", lsdCoin.address);
    
    // Can't bribe before any user votes
    const ethxPoolBribeAmount1 = ethers.utils.parseUnits("1000", 18);
    await expect(ethx.connect(Alice).mint(Bob.address, ethxPoolBribeAmount1)).not.to.be.reverted;
    await expect(ethx.connect(Bob).approve(votes.address, ethxPoolBribeAmount1)).not.to.be.reverted;
    await expect(votes.connect(Bob).bribe(3, ethxPoolBribeAmount1)).to.be.rejectedWith(/Invalid voting pool/);
    await expect(votes.connect(Bob).bribe(ethxPoolId, ethxPoolBribeAmount1)).to.be.rejectedWith(/Not a briber/);
    await expect(votes.connect(Alice).addBriber(Bob.address))
      .to.emit(votes, 'BriberAdded').withArgs(Bob.address);
    await expect(votes.connect(Bob).bribe(ethxPoolId, ethxPoolBribeAmount1)).to.be.rejectedWith(/No votes yet/);

    // Alice votes 800 $esLSD for ETHx pool; Bob votes 200 $esLSD for ETHx pool
    const aliceVoteAmount1 = ethers.utils.parseUnits("800", 18);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, aliceVoteAmount1)).not.to.be.reverted;
    await expect(lsdCoin.connect(Alice).approve(esLSD.address, aliceVoteAmount1)).not.to.be.reverted;
    await expect(esLSD.connect(Alice).escrow(aliceVoteAmount1)).not.to.be.rejected;
    await expect(esLSD.connect(Alice).approve(votes.address, aliceVoteAmount1)).not.to.be.reverted;
    const bobVoteAmount1 = ethers.utils.parseUnits("200", 18);
    await expect(lsdCoin.connect(Alice).mint(Bob.address, bobVoteAmount1)).not.to.be.reverted;
    await expect(lsdCoin.connect(Bob).approve(esLSD.address, bobVoteAmount1)).not.to.be.reverted;
    await expect(esLSD.connect(Bob).escrow(bobVoteAmount1)).not.to.be.rejected;
    await expect(esLSD.connect(Bob).approve(votes.address, bobVoteAmount1)).not.to.be.reverted;

    // Alice do the vote first, and one day later Bob do the vote
    await expect(votes.connect(Alice).vote(ethxPoolId, aliceVoteAmount1))
      .to.emit(esLSD, 'Transfer').withArgs(Alice.address, votes.address, aliceVoteAmount1)
      .to.emit(votes, 'Voted').withArgs(ethxPoolId, Alice.address, aliceVoteAmount1);
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS);
    await expect(votes.connect(Bob).vote(ethxPoolId, bobVoteAmount1))
      .to.emit(esLSD, 'Transfer').withArgs(Bob.address, votes.address, bobVoteAmount1)
      .to.emit(votes, 'Voted').withArgs(ethxPoolId, Bob.address, bobVoteAmount1);
    expect(await votes.totalVotes(ethxPoolId)).to.equal(aliceVoteAmount1.add(bobVoteAmount1));
    expect(await votes.userVotes(ethxPoolId, Alice.address)).to.equal(aliceVoteAmount1);
    expect(await votes.userVotes(ethxPoolId, Bob.address)).to.equal(bobVoteAmount1);

    // Bob add bribe rewards to ethx pool
    await expect(votes.connect(Bob).bribe(ethxPoolId, ethxPoolBribeAmount1))
      .to.emit(ethx, 'Transfer').withArgs(Bob.address, votes.address, ethxPoolBribeAmount1)
      .to.emit(votes, 'BribeRewardsAdded').withArgs(ethxPoolId, Bob.address, ethxPoolBribeAmount1);

    // Alice should get 80% of the bribe rewards, Bob should get 20% of the bribe rewards
    const aliceBribeReward1 = ethxPoolBribeAmount1.mul(80).div(100);
    const bobBribeReward1 = ethxPoolBribeAmount1.sub(aliceBribeReward1);
    expectBigNumberEquals(aliceBribeReward1, await votes.bribeRewardsEarned(ethxPoolId, Alice.address));
    expectBigNumberEquals(bobBribeReward1, await votes.bribeRewardsEarned(ethxPoolId, Bob.address));

    // Bob withdraw his bribe rewards
    await expect(votes.connect(Bob).getBribeRewards(ethxPoolId))
      .to.emit(ethx, 'Transfer').withArgs(votes.address, Bob.address, bobBribeReward1)
      .to.emit(votes, 'BribeRewardsPaid').withArgs(ethxPoolId, Bob.address, bobBribeReward1);
    
    // Alice does not withdraw her bribe rewards, but unvotes half of her votes (400 out of 800 $esLSD)
    const aliceUnvoteAmount1 = ethers.utils.parseUnits("400", 18);
    await expect(votes.connect(Alice).unvote(ethxPoolId, aliceUnvoteAmount1))
      .to.emit(esLSD, 'Transfer').withArgs(votes.address, Alice.address, aliceUnvoteAmount1)
      .to.emit(votes, 'Unvoted').withArgs(ethxPoolId, Alice.address, aliceUnvoteAmount1);
    
    // Alice batch votes 200 $esLSD for ETHx pool, and 100 $esLSD for LSD pool
    const aliceBatchVote1EthxPoolAmount = ethers.utils.parseUnits("200", 18);
    const aliceBatchVote1LsdxPoolAmount = ethers.utils.parseUnits("100", 18);
    await expect(esLSD.connect(Alice).approve(votes.address, aliceBatchVote1EthxPoolAmount.add(aliceBatchVote1LsdxPoolAmount))).not.to.be.reverted;
    await expect(votes.connect(Alice).batchVote([
      {poolId: ethxPoolId, amount: aliceBatchVote1EthxPoolAmount},
      {poolId: 3, amount: aliceBatchVote1LsdxPoolAmount}
    ])).to.be.rejectedWith(/Invalid voting pool/);
    await expect(votes.connect(Alice).batchVote([
      {poolId: ethxPoolId, amount: aliceBatchVote1EthxPoolAmount},
      {poolId: lsdPoolId, amount: aliceBatchVote1LsdxPoolAmount}
    ]))
      .to.emit(esLSD, 'Transfer').withArgs(Alice.address, votes.address, aliceBatchVote1EthxPoolAmount)
      .to.emit(votes, 'Voted').withArgs(ethxPoolId, Alice.address, aliceBatchVote1EthxPoolAmount)
      .to.emit(esLSD, 'Transfer').withArgs(Alice.address, votes.address, aliceBatchVote1LsdxPoolAmount)
      .to.emit(votes, 'Voted').withArgs(lsdPoolId, Alice.address, aliceBatchVote1LsdxPoolAmount);
    
    expect(await votes.totalVotes(ethxPoolId)).to.equal(aliceVoteAmount1.add(bobVoteAmount1).sub(aliceUnvoteAmount1).add(aliceBatchVote1EthxPoolAmount));
    expect(await votes.userVotes(ethxPoolId, Alice.address)).to.equal(aliceVoteAmount1.sub(aliceUnvoteAmount1).add(aliceBatchVote1EthxPoolAmount));
    expect(await votes.userVotes(ethxPoolId, Bob.address)).to.equal(bobVoteAmount1);
    expect(await votes.totalVotes(lsdPoolId)).to.equal(aliceBatchVote1LsdxPoolAmount);
    expect(await votes.userVotes(lsdPoolId, Alice.address)).to.equal(aliceBatchVote1LsdxPoolAmount);

    // Current status:
    // ETHx Pool:
    //  Alice: 800 - 400 + 200 = 600 $esLSD. Rewards unclaimed (aliceBribeReward1)
    //  Bob: 200 $esLSD. Rewards all claimed
    // LSD Pool:
    //  Alice: 100 $esLSD. No rewards
    //  Bob: 0 $esLSD. No rewards
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 2);

    // Caro add bribe rewards:
    //  ETHx Pool: 8000 $ETHx. ==> $6000 to Alice, $2000 to Bob
    //  LSD Pool: 1000 $LSD.  ==> $1000 to Alice
    const ethxPoolBribeAmount2 = ethers.utils.parseUnits("8000", 18);
    const lsdPoolBribeAmount1 = ethers.utils.parseUnits("1000", 18);
    await expect(ethx.connect(Alice).mint(Caro.address, ethxPoolBribeAmount2)).not.to.be.reverted;
    await expect(lsdCoin.connect(Alice).mint(Caro.address, lsdPoolBribeAmount1)).not.to.be.reverted;
    await expect(ethx.connect(Caro).approve(votes.address, ethxPoolBribeAmount2)).not.to.be.reverted;
    await expect(lsdCoin.connect(Caro).approve(votes.address, lsdPoolBribeAmount1)).not.to.be.reverted;
    await expect(votes.connect(Alice).removeBriber(Bob.address))
      .to.emit(votes, 'BriberRemoved').withArgs(Bob.address);
    await expect(votes.connect(Bob).bribe(ethxPoolId, ethxPoolBribeAmount1)).to.be.rejectedWith(/Not a briber/);
    await expect(votes.connect(Alice).addBriber(Caro.address))
      .to.emit(votes, 'BriberAdded').withArgs(Caro.address);
    await expect(votes.connect(Caro).bribe(ethxPoolId, ethxPoolBribeAmount2))
      .to.emit(ethx, 'Transfer').withArgs(Caro.address, votes.address, ethxPoolBribeAmount2)
      .to.emit(votes, 'BribeRewardsAdded').withArgs(ethxPoolId, Caro.address, ethxPoolBribeAmount2);
    await expect(votes.connect(Caro).bribe(lsdPoolId, lsdPoolBribeAmount1))
      .to.emit(lsdCoin, 'Transfer').withArgs(Caro.address, votes.address, lsdPoolBribeAmount1)
      .to.emit(votes, 'BribeRewardsAdded').withArgs(lsdPoolId, Caro.address, lsdPoolBribeAmount1);

    // Check rewards
    const aliceETHxPoolBribeReward2 = ethxPoolBribeAmount2.mul(600).div(800).add(aliceBribeReward1);
    const bobETHxPoolBribeReward2 = ethxPoolBribeAmount2.mul(200).div(800);
    const aliceLsdBribeReward = lsdPoolBribeAmount1;
    expectBigNumberEquals(aliceETHxPoolBribeReward2, await votes.bribeRewardsEarned(ethxPoolId, Alice.address));
    expectBigNumberEquals(bobETHxPoolBribeReward2, await votes.bribeRewardsEarned(ethxPoolId, Bob.address));
    expectBigNumberEquals(aliceLsdBribeReward, await votes.bribeRewardsEarned(lsdPoolId, Alice.address));
    expectBigNumberEquals(BigNumber.from(0), await votes.bribeRewardsEarned(lsdPoolId, Bob.address));

    // Alice unvotes all pools
    await expect(votes.connect(Alice).unvoteAll())
      .to.emit(esLSD, 'Transfer').withArgs(votes.address, Alice.address, aliceVoteAmount1.sub(aliceUnvoteAmount1).add(aliceBatchVote1EthxPoolAmount))
      .to.emit(votes, 'Unvoted').withArgs(ethxPoolId, Alice.address, aliceVoteAmount1.sub(aliceUnvoteAmount1).add(aliceBatchVote1EthxPoolAmount))
      .to.emit(esLSD, 'Transfer').withArgs(votes.address, Alice.address, aliceBatchVote1LsdxPoolAmount)
      .to.emit(votes, 'Unvoted').withArgs(lsdPoolId, Alice.address, aliceBatchVote1LsdxPoolAmount);
    expect(await votes.userVotes(ethxPoolId, Alice.address)).to.equal(BigNumber.from(0));
    expect(await votes.userVotes(lsdPoolId, Alice.address)).to.equal(BigNumber.from(0));

    // Deprecate ETHx pool
    await expect(votes.connect(Bob).deprecateVotingPool(ethxPoolId, true)).to.be.rejectedWith(/Ownable: caller is not the owner/);
    await expect(votes.connect(Alice).deprecateVotingPool(ethxPoolId, true))
      .to.emit(votes, 'VotingPoolDeprecated').withArgs(ethxPoolId, true);
    
    // Could not vote or bribe to deprecated pool
    await expect(votes.connect(Alice).vote(ethxPoolId, aliceVoteAmount1)).to.be.rejectedWith(/Voting pool deprecated/);
    await expect(votes.connect(Alice).bribe(ethxPoolId, ethxPoolBribeAmount1)).to.be.rejectedWith(/Voting pool deprecated/);

    // Yet user could unvote or withdraw bribe rewards from deprecated pool
    await expect(votes.connect(Bob).unvote(ethxPoolId, bobVoteAmount1))
      .to.emit(esLSD, 'Transfer').withArgs(votes.address, Bob.address, bobVoteAmount1)
      .to.emit(votes, 'Unvoted').withArgs(ethxPoolId, Bob.address, bobVoteAmount1);

    await expect(votes.connect(Alice).getBribeRewards(ethxPoolId))
      .to.emit(ethx, 'Transfer').withArgs(votes.address, Alice.address, aliceETHxPoolBribeReward2)
      .to.emit(votes, 'BribeRewardsPaid').withArgs(ethxPoolId, Alice.address, aliceETHxPoolBribeReward2);

    await expect(votes.connect(Alice).getAllBribeRewards())
      .to.emit(lsdCoin, 'Transfer').withArgs(votes.address, Alice.address, aliceLsdBribeReward)
      .to.emit(votes, 'BribeRewardsPaid').withArgs(lsdPoolId, Alice.address, aliceLsdBribeReward);
    
    // Deprecated pool could be bring back to active
    await expect(votes.connect(Alice).deprecateVotingPool(ethxPoolId, false))
      .to.emit(votes, 'VotingPoolDeprecated').withArgs(ethxPoolId, false);

  });

  it('Batch vote works', async () => {

    const { lsdCoin, esLSD, ethx, votes, Alice, Bob, Caro } = await loadFixture(deployLsdxV2ContractsFixture);

    const genesisTime = await time.latest();

    // Create 2 voting pools with bribe token:  $ETHx, $LSD
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 1);
    await expect(votes.connect(Bob).addVotingPool("ETHx Voting Pool", ethx.address)).to.be.rejectedWith(/Ownable: caller is not the owner/);
    const lsdPoolId = 1;
    await expect(votes.connect(Alice).addVotingPool("LSD Voting Pool", lsdCoin.address))
      .to.emit(votes, 'VotingPoolAdded').withArgs(lsdPoolId, "LSD Voting Pool", lsdCoin.address);

    const ethxPoolId = 2;
    await expect(votes.connect(Alice).addVotingPool("ETHx Voting Pool", ethx.address))
      .to.emit(votes, 'VotingPoolAdded').withArgs(ethxPoolId, "ETHx Voting Pool", ethx.address);

    // Alice batch votes 20 $esLSD to lsd pool, and 30 $esLSD to ethx pool
    const aliceBatchVote1LsdxPoolAmount = ethers.utils.parseUnits("20", 18);
    const aliceBatchVote1EthxPoolAmount = ethers.utils.parseUnits("30", 18);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, aliceBatchVote1LsdxPoolAmount.add(aliceBatchVote1EthxPoolAmount))).not.to.be.reverted;
    await expect(lsdCoin.connect(Alice).approve(esLSD.address, aliceBatchVote1LsdxPoolAmount.add(aliceBatchVote1EthxPoolAmount))).not.to.be.reverted;
    await expect(esLSD.connect(Alice).escrow(aliceBatchVote1LsdxPoolAmount.add(aliceBatchVote1EthxPoolAmount))).not.to.be.rejected;

    await expect(esLSD.connect(Alice).approve(votes.address, aliceBatchVote1EthxPoolAmount.add(aliceBatchVote1LsdxPoolAmount))).not.to.be.reverted;
    await expect(votes.connect(Alice).batchVote([
      {poolId: lsdPoolId, amount: aliceBatchVote1LsdxPoolAmount},
      {poolId: ethxPoolId, amount: aliceBatchVote1EthxPoolAmount}
    ]))
      .to.emit(esLSD, 'Transfer').withArgs(Alice.address, votes.address, aliceBatchVote1LsdxPoolAmount)
      .to.emit(votes, 'Voted').withArgs(lsdPoolId, Alice.address, aliceBatchVote1LsdxPoolAmount)
      .to.emit(esLSD, 'Transfer').withArgs(Alice.address, votes.address, aliceBatchVote1EthxPoolAmount)
      .to.emit(votes, 'Voted').withArgs(ethxPoolId, Alice.address, aliceBatchVote1EthxPoolAmount);

    // Day 2. Bob batch votes 12 $esLSD to lsd pool, and 20 $esLSD to ethx pool
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 2);
    const bobBatchVote1LsdxPoolAmount = ethers.utils.parseUnits("12", 18);
    const bobBatchVote1EthxPoolAmount = ethers.utils.parseUnits("20", 18);
    await expect(lsdCoin.connect(Alice).mint(Bob.address, bobBatchVote1LsdxPoolAmount.add(bobBatchVote1EthxPoolAmount))).not.to.be.reverted;
    await expect(lsdCoin.connect(Bob).approve(esLSD.address, bobBatchVote1LsdxPoolAmount.add(bobBatchVote1EthxPoolAmount))).not.to.be.reverted;
    await expect(esLSD.connect(Bob).escrow(bobBatchVote1LsdxPoolAmount.add(bobBatchVote1EthxPoolAmount))).not.to.be.rejected;

    await expect(esLSD.connect(Bob).approve(votes.address, bobBatchVote1LsdxPoolAmount.add(bobBatchVote1EthxPoolAmount))).not.to.be.reverted;
    await expect(votes.connect(Bob).batchVote([
      {poolId: lsdPoolId, amount: bobBatchVote1LsdxPoolAmount},
      {poolId: ethxPoolId, amount: bobBatchVote1EthxPoolAmount}
    ]))
      .to.emit(esLSD, 'Transfer').withArgs(Bob.address, votes.address, bobBatchVote1LsdxPoolAmount)
      .to.emit(votes, 'Voted').withArgs(lsdPoolId, Bob.address, bobBatchVote1LsdxPoolAmount)
      .to.emit(esLSD, 'Transfer').withArgs(Bob.address, votes.address, bobBatchVote1EthxPoolAmount)
      .to.emit(votes, 'Voted').withArgs(ethxPoolId, Bob.address, bobBatchVote1EthxPoolAmount);
    
    // Day 3. Alice add 100 $LSD bribe rewards to lsd pool
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 3);
    const lsdPoolBribeAmount1 = ethers.utils.parseUnits("100", 18);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, lsdPoolBribeAmount1)).not.to.be.reverted;
    await expect(lsdCoin.connect(Alice).approve(votes.address, lsdPoolBribeAmount1)).not.to.be.reverted;
    await expect(votes.connect(Alice).bribe(lsdPoolId, lsdPoolBribeAmount1))
      .to.emit(lsdCoin, 'Transfer').withArgs(Alice.address, votes.address, lsdPoolBribeAmount1)
      .to.emit(votes, 'BribeRewardsAdded').withArgs(lsdPoolId, Alice.address, lsdPoolBribeAmount1);
    
    // Alice's bribe amount: 100 * 20 / 32 = 62.5
    // Bob's bribe amount: 100 * 12 / 32 = 37.5
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 3.5);
    expectBigNumberEquals(lsdPoolBribeAmount1.mul(20).div(32), await votes.bribeRewardsEarned(lsdPoolId, Alice.address));
    expectBigNumberEquals(lsdPoolBribeAmount1.mul(12).div(32), await votes.bribeRewardsEarned(lsdPoolId, Bob.address));

    // Caro add 20 $esLSD to lsd pool, but should get no rewards
    const caroVoteAmount1 = ethers.utils.parseUnits("20", 18);
    await expect(lsdCoin.connect(Alice).mint(Caro.address, caroVoteAmount1)).not.to.be.reverted;
    await expect(lsdCoin.connect(Caro).approve(esLSD.address, caroVoteAmount1)).not.to.be.reverted;
    await expect(esLSD.connect(Caro).escrow(caroVoteAmount1)).not.to.be.rejected;
    await expect(esLSD.connect(Caro).approve(votes.address, caroVoteAmount1)).not.to.be.reverted;

    await expect(votes.connect(Caro).vote(lsdPoolId, caroVoteAmount1))
      .to.emit(esLSD, 'Transfer').withArgs(Caro.address, votes.address, caroVoteAmount1)
      .to.emit(votes, 'Voted').withArgs(lsdPoolId, Caro.address, caroVoteAmount1);
    expectBigNumberEquals(lsdPoolBribeAmount1.mul(20).div(32), await votes.bribeRewardsEarned(lsdPoolId, Alice.address));
    expectBigNumberEquals(lsdPoolBribeAmount1.mul(12).div(32), await votes.bribeRewardsEarned(lsdPoolId, Bob.address));
    expectBigNumberEquals(BigNumber.from(0), await votes.bribeRewardsEarned(lsdPoolId, Caro.address));

    // Day 4. Alice add another 50 $LSD bribe rewards to lsd pool
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 4);
    const lsdPoolBribeAmount2 = ethers.utils.parseUnits("50", 18);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, lsdPoolBribeAmount2)).not.to.be.reverted;
    await expect(lsdCoin.connect(Alice).approve(votes.address, lsdPoolBribeAmount2)).not.to.be.reverted;
    await expect(votes.connect(Alice).bribe(lsdPoolId, lsdPoolBribeAmount2))
      .to.emit(lsdCoin, 'Transfer').withArgs(Alice.address, votes.address, lsdPoolBribeAmount2)
      .to.emit(votes, 'BribeRewardsAdded').withArgs(lsdPoolId, Alice.address, lsdPoolBribeAmount2);
    
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 4.1);
    expectBigNumberEquals(lsdPoolBribeAmount1.mul(20).div(32).add(lsdPoolBribeAmount2.mul(20).div(52)), await votes.bribeRewardsEarned(lsdPoolId, Alice.address));
    expectBigNumberEquals(lsdPoolBribeAmount1.mul(12).div(32).add(lsdPoolBribeAmount2.mul(12).div(52)), await votes.bribeRewardsEarned(lsdPoolId, Bob.address));
    expectBigNumberEquals(BigNumber.from(0).add(lsdPoolBribeAmount2.mul(20).div(52)), await votes.bribeRewardsEarned(lsdPoolId, Caro.address));

  });
});