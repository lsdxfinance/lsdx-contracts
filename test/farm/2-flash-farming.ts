import _ from 'lodash';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { ONE_DAY_IN_SECS, deployLsdxContractsFixture, expandTo18Decimals, expectBigNumberEquals } from '../utils';
import { FlashFarm__factory } from '../../typechain';

const { provider } = ethers;

describe('Flash Farm', () => {

  it('Basic scenario works', async () => {

    const { lsdCoin, erc20, Alice, Bob, Caro } = await loadFixture(deployLsdxContractsFixture);

    const FlashFarm = await ethers.getContractFactory('FlashFarm');
    const FlashFarmContract = await FlashFarm.deploy(lsdCoin.address, erc20.address);
    const flashFarm = FlashFarm__factory.connect(FlashFarmContract.address, provider);

    const genesisTime = (await time.latest()) + ONE_DAY_IN_SECS;
    await expect(erc20.connect(Alice).mint(Bob.address, expandTo18Decimals(10_000))).not.to.be.reverted;
    await expect(erc20.connect(Alice).mint(Caro.address, expandTo18Decimals(10_000))).not.to.be.reverted;

    // Bob stakes 800 $LSD, and Caro stakes 200 $LSD
    let bobStakeAmount = expandTo18Decimals(800);
    let caroStakeAmount = expandTo18Decimals(200);
    await expect(erc20.connect(Bob).approve(flashFarm.address, bobStakeAmount)).not.to.be.reverted;
    await expect(flashFarm.connect(Bob).stake(bobStakeAmount)).not.to.be.reverted;
    await expect(erc20.connect(Caro).approve(flashFarm.address, caroStakeAmount)).not.to.be.reverted;
    await expect(flashFarm.connect(Caro).stake(caroStakeAmount)).not.to.be.reverted;
    expect(await flashFarm.totalSupply()).to.equal(bobStakeAmount.add(caroStakeAmount));

    // Fast-forward to reward start time, and deposit 10_000 $LSD as reward
    await time.increaseTo(genesisTime);
    const totalReward = expandTo18Decimals(10_000);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, totalReward)).not.to.be.reverted;
    await expect(lsdCoin.connect(Alice).approve(flashFarm.address, totalReward)).not.to.be.reverted;
    await expect(flashFarm.connect(Alice).addRewards(totalReward))
      .to.emit(flashFarm, 'RewardAdded').withArgs(totalReward);

    // Fast-forward to Day 2. Reward perioid finish
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 2);

    // Bob should get 4/5 rewards, and Caro should get 1/5 rewards
    expectBigNumberEquals(totalReward.mul(4).div(5), await flashFarm.earned(Bob.address));
    expectBigNumberEquals(totalReward.mul(1).div(5), await flashFarm.earned(Caro.address));

    // Bob claim rewards
    // console.log('Bob earned', ethers.utils.formatUnits((await flashFarm.earned(Bob.address)).toString(), 18));
    await expect(flashFarm.connect(Bob).getReward())
      .to.emit(flashFarm, 'RewardPaid').withArgs(Bob.address, anyValue);
    
    // Fast-forward to Day 5, and start another round of reward
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 5);
    const round2Reward = expandTo18Decimals(20_000);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, round2Reward)).not.to.be.reverted;
    await expect(lsdCoin.connect(Alice).approve(flashFarm.address, round2Reward)).not.to.be.reverted;
    await expect(flashFarm.connect(Alice).addRewards(round2Reward))
      .to.emit(flashFarm, 'RewardAdded').withArgs(round2Reward);

    // Fast-forward to Day 7. Bob should get 4/5 rewards, and Caro should get 1/5 rewards
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 7);
    expectBigNumberEquals(round2Reward.mul(4).div(5), await flashFarm.earned(Bob.address));
    expectBigNumberEquals(totalReward.mul(1).div(5).add(round2Reward.mul(1).div(5)), await flashFarm.earned(Caro.address));

    // Bob withdraw 600 stakes. Going forward, Bob and Caro should get 1/2 rewards respectively
    await expect(flashFarm.connect(Bob).withdraw(expandTo18Decimals(600))).not.to.be.reverted;

    // Fast-forward to Day 9. Add new reward
    await time.increaseTo(genesisTime + ONE_DAY_IN_SECS * 9);
    const round3Reward = expandTo18Decimals(30_000);
    await expect(lsdCoin.connect(Alice).mint(Alice.address, round3Reward)).not.to.be.reverted;
    await expect(lsdCoin.connect(Alice).approve(flashFarm.address, round3Reward)).not.to.be.reverted;
    await expect(flashFarm.connect(Alice).addRewards(round3Reward)).not.to.be.reverted;

    // Check Bob and Caro's rewards
    expectBigNumberEquals(round2Reward.mul(4).div(5).add(round3Reward.mul(1).div(2)), await flashFarm.earned(Bob.address));
    expectBigNumberEquals(totalReward.mul(1).div(5).add(round2Reward.mul(1).div(5)).add(round3Reward.mul(1).div(2)), await flashFarm.earned(Caro.address));

  });

});