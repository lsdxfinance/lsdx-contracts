import _ from 'lodash';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ONE_DAY_IN_SECS, deployLsdxContractsFixture } from '../utils';
import { MerkleDistributorWithDeadline__factory } from '../../typechain';
import BalanceTree from '../../src/balance-tree';

const { provider } = ethers;

const dayjs = require('dayjs');

describe('Merkle Distributor', () => {

  it('merkle-distributor works', async () => {
    const { erc20, Alice, Bob, Caro, Dave } = await loadFixture(deployLsdxContractsFixture);

    const aliceAmount = ethers.utils.parseUnits('100.5', 18);
    const bobAmount = ethers.utils.parseUnits('2.5', 18);
    const caroAmount = ethers.utils.parseUnits('0.01', 18);
    const daveAmount = ethers.utils.parseUnits('6.009', 18);
    const totalAmount = aliceAmount.add(bobAmount).add(caroAmount).add(daveAmount);

    const distributionList = [
      { account: Alice.address, amount: aliceAmount },
      { account: Bob.address, amount: bobAmount },
      { account: Caro.address, amount: caroAmount },
      { account: Dave.address, amount: daveAmount }
    ];
    const merkleTree = new BalanceTree(distributionList);

    const endTime = dayjs().add(30, 'day').unix();
    const MerkleDistributorWithDeadline = await ethers.getContractFactory('MerkleDistributorWithDeadline');
    const merkleDistributorContract = await MerkleDistributorWithDeadline.deploy(erc20.address, merkleTree.getHexRoot(), endTime);
    const merkleDistributor = MerkleDistributorWithDeadline__factory.connect(merkleDistributorContract.address, provider);

    // Alice should fail to claim before the contract is funded
    expect(await merkleDistributor.isClaimed(0)).to.equal(false);
    const aliceProof = merkleTree.getProof(0, Alice.address, aliceAmount);
    await expect(merkleDistributor.connect(Alice).claim(0, Alice.address, aliceAmount, aliceProof)).to.be.rejectedWith(
      /ERC20: transfer amount exceeds balance/,
    );

    // Fund the contract (could be multiple transactions)
    expect(await erc20.balanceOf(merkleDistributor.address)).to.equal(0);
    await expect(erc20.connect(Alice).mint(Alice.address, totalAmount)).not.to.be.reverted;
    await expect(erc20.connect(Alice).transfer(merkleDistributor.address, totalAmount.div(2))).not.to.be.reverted;
    await expect(erc20.connect(Alice).transfer(merkleDistributor.address, totalAmount.div(2))).not.to.be.reverted;

    // Now Alice could claim her rewards
    await expect(merkleDistributor.connect(Alice).claim(0, Alice.address, aliceAmount, aliceProof))
      .to.emit(erc20, 'Transfer').withArgs(merkleDistributor.address, Alice.address, aliceAmount)
      .to.emit(merkleDistributor, 'Claimed').withArgs(0, Alice.address, aliceAmount);
    expect(await merkleDistributor.isClaimed(0)).to.equal(true);
    
    // Caro could pay the gas to claim rewards for Bob
    const bobProof = merkleTree.getProof(1, Bob.address, bobAmount);
    await expect(merkleDistributor.connect(Caro).claim(1, Bob.address, bobAmount, bobProof))
      .to.emit(erc20, 'Transfer').withArgs(merkleDistributor.address, Bob.address, bobAmount)
      .to.emit(merkleDistributor, 'Claimed').withArgs(1, Bob.address, bobAmount);
    expect(await merkleDistributor.isClaimed(1)).to.equal(true);

    // Bob's rewards could not be re-claimed
    await expect(merkleDistributor.connect(Bob).claim(1, Bob.address, bobAmount, bobProof)).to.be.rejected;

    // Caro's rewards could not be claimed with an invalid proof or amount
    await expect(merkleDistributor.connect(Caro).claim(2, Caro.address, bobAmount, bobProof)).to.be.rejected;
    await expect(merkleDistributor.connect(Caro).claim(2, Caro.address, caroAmount, bobProof)).to.be.rejected;

    // 30 days later, could not be claimed
    await time.increase(ONE_DAY_IN_SECS * 30);
    const daveProof = merkleTree.getProof(3, Dave.address, daveAmount);
    await expect(merkleDistributor.connect(Dave).claim(3, Dave.address, daveAmount, daveProof))
      .to.be.rejectedWith(
        /ClaimWindowFinished/,
      );
    
    // Withdraw coins
    await expect(merkleDistributor.connect(Alice).withdraw()).not.to.be.reverted;
  });

});