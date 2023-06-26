import _ from 'lodash';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { ONE_DAY_IN_SECS, deployLsdxV2ContractsFixture, expandTo18Decimals, expectBigNumberEquals } from '../utils';

const { provider } = ethers;

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

  it.only('E2E scenario works', async () => {

    const { lsdCoin, esLSD, ethx, votes, Alice, Bob, Caro } = await loadFixture(deployLsdxV2ContractsFixture);

    await expect(votes.connect(Bob).addVotingPool("ETHx Voting Pool", ethx.address)).to.be.rejectedWith(/Ownable: caller is not the owner/);
    let nextPoolId = 1;
    await expect(votes.connect(Alice).addVotingPool("ETHx Voting Pool", ethx.address))
      .to.emit(votes, 'VotingPoolAdded').withArgs(nextPoolId, "ETHx Voting Pool", ethx.address);



  });

});