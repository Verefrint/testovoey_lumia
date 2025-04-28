import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers, network } from "hardhat";
import { expect } from "chai";
import "@nomicfoundation/hardhat-chai-matchers";

describe("Airdrop", function () {
  async function deployAirdropFixture() {
    const [owner, user1, user2] = await ethers.getSigners();

    const TokenFactory = await ethers.getContractFactory("TestToken", owner);
    const token = await TokenFactory.deploy("TestToken", "TTK", 18);
    await token.waitForDeployment();

    await token.mint(owner.address, ethers.parseEther("10000"));

    const AirdropFactory = await ethers.getContractFactory("Airdrop", owner);
    const airdrop = await AirdropFactory.deploy(owner.address);
    await airdrop.waitForDeployment();

    return { owner, user1, user2, token, airdrop };
  }

  describe("Start Campaign", function () {
    it("should start a new campaign", async function () {
      const { owner, token, airdrop } = await loadFixture(deployAirdropFixture);

      const totalAllocated = ethers.parseEther("1000");
      await token.approve(await airdrop.getAddress(), totalAllocated);

      await expect(airdrop.startCompaign(await token.getAddress(), totalAllocated))
        .to.emit(airdrop, "StartAirdrop");

      const campaign = await airdrop.campaigns(1);
      expect(campaign.token).to.equal(await token.getAddress());
    });

    it("should revert with empty address", async function () {
      const { airdrop } = await loadFixture(deployAirdropFixture);

      await expect(
        airdrop.startCompaign(ethers.ZeroAddress, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(airdrop, "EmptyAddress");
    });
  });

  describe("Upload Participants", function () {
    it("should upload participants", async function () {
      const { user1, user2, token, airdrop } = await loadFixture(deployAirdropFixture);

      const totalAllocated = ethers.parseEther("1000");
      await token.approve(await airdrop.getAddress(), totalAllocated);
      await airdrop.startCompaign(await token.getAddress(), totalAllocated);

      const participants = [
        { user: user1.address, amount: ethers.parseEther("100"), campaignId: 1 },
        { user: user2.address, amount: ethers.parseEther("200"), campaignId: 1 }
      ];

      await expect(airdrop.uploadParticipants(participants)).to.emit(airdrop, "NewAirdropParticipants");

      expect(await airdrop.campaignDistribution(1, user1.address)).to.equal(ethers.parseEther("100"));
      expect(await airdrop.campaignDistribution(1, user2.address)).to.equal(ethers.parseEther("200"));
    });

    it("should revert on empty array", async function () {
      const { airdrop } = await loadFixture(deployAirdropFixture);

      await expect(airdrop.uploadParticipants([])).to.be.revertedWithCustomError(airdrop, "EmptyDestibutionArray");
    });
  });

  describe("Finalize Campaign", function () {
    it("should finalize a campaign", async function () {
      const { token, airdrop } = await loadFixture(deployAirdropFixture);

      const totalAllocated = ethers.parseEther("1000");
      await token.approve(await airdrop.getAddress(), totalAllocated);
      await airdrop.startCompaign(await token.getAddress(), totalAllocated);

      const now = (await ethers.provider.getBlock("latest")).timestamp;

      await expect(airdrop.finalizeCampaign(1, now + 10, 30)).to.not.be.reverted;

      const campaign = await airdrop.campaigns(1);
      expect(campaign.finalized).to.be.true;
    });

    it("should revert if start time is in the past", async function () {
      const { token, airdrop } = await loadFixture(deployAirdropFixture);

      const totalAllocated = ethers.parseEther("1000");
      await token.approve(await airdrop.getAddress(), totalAllocated);
      await airdrop.startCompaign(await token.getAddress(), totalAllocated);

      const now = (await ethers.provider.getBlock("latest")).timestamp;

      await expect(airdrop.finalizeCampaign(1, now - 1, 30)).to.be.revertedWithCustomError(airdrop, "NotAllowedStartCampaignInPast");
    });
  });

  describe("Claim Tokens", function () {
    it("should allow user to claim tokens", async function () {
      const { user1, token, airdrop } = await loadFixture(deployAirdropFixture);

      const totalAllocated = ethers.parseEther("1000");
      await token.approve(await airdrop.getAddress(), totalAllocated);
      await airdrop.startCompaign(await token.getAddress(), totalAllocated);

      const participants = [
        { user: user1.address, amount: ethers.parseEther("100"), campaignId: 1 }
      ];
      await airdrop.uploadParticipants(participants);

      const now = (await ethers.provider.getBlock("latest")).timestamp;
      await airdrop.finalizeCampaign(1, now + 1, 1);

      await network.provider.send("evm_increaseTime", [2 * 86400]);
      await network.provider.send("evm_mine");

      const beforeBalance = await token.balanceOf(user1.address);

      await expect(airdrop.connect(user1).claim(1, ethers.parseEther("50"))).to.not.be.reverted;

      const afterBalance = await token.balanceOf(user1.address);

      expect(afterBalance - beforeBalance).to.equal(ethers.parseEther("50"));
    });

    it("should revert if claiming too much", async function () {
      const { user1, token, airdrop } = await loadFixture(deployAirdropFixture);

      const totalAllocated = ethers.parseEther("1000");
      await token.approve(await airdrop.getAddress(), totalAllocated);
      await airdrop.startCompaign(await token.getAddress(), totalAllocated);

      const participants = [
        { user: user1.address, amount: ethers.parseEther("100"), campaignId: 1 }
      ];
      await airdrop.uploadParticipants(participants);

      const now = (await ethers.provider.getBlock("latest")).timestamp;
      await airdrop.finalizeCampaign(1, now + 1, 1);

      await network.provider.send("evm_increaseTime", [2 * 86400]);
      await network.provider.send("evm_mine");

      await expect(airdrop.connect(user1).claim(1, ethers.parseEther("200"))).to.be.revertedWithCustomError(airdrop, "TooManyForWitdraw");
    });
  });

  describe("Errors and Complex Behavior", function () {
    it("should revert if uploadParticipants with empty array", async function () {
      const { airdrop } = await loadFixture(deployAirdropFixture);

      await expect(airdrop.uploadParticipants([])).to.be.revertedWithCustomError(airdrop, "EmptyDestibutionArray");
    });

    it("should revert if campaign is finalized and trying to upload more participants", async function () {
      const { user1, token, airdrop } = await loadFixture(deployAirdropFixture);

      const totalAllocated = ethers.parseEther("1000");
      await token.approve(await airdrop.getAddress(), totalAllocated);
      await airdrop.startCompaign(await token.getAddress(), totalAllocated);

      const participants = [{ user: user1.address, amount: ethers.parseEther("100"), campaignId: 1 }];
      await airdrop.uploadParticipants(participants);

      const now = (await ethers.provider.getBlock("latest")).timestamp;
      await airdrop.finalizeCampaign(1, now + 1, 10);

      const newParticipants = [{ user: user1.address, amount: ethers.parseEther("200"), campaignId: 1 }];

      await expect(airdrop.uploadParticipants(newParticipants)).to.be.revertedWithCustomError(airdrop, "CampaignFinalized");
    });

    it("should revert claim before campaign finalized", async function () {
      const { user1, token, airdrop } = await loadFixture(deployAirdropFixture);

      const totalAllocated = ethers.parseEther("1000");
      await token.approve(await airdrop.getAddress(), totalAllocated);
      await airdrop.startCompaign(await token.getAddress(), totalAllocated);

      const participants = [{ user: user1.address, amount: ethers.parseEther("100"), campaignId: 1 }];
      await airdrop.uploadParticipants(participants);

      await expect(airdrop.connect(user1).claim(1, ethers.parseEther("50")))
        .to.be.revertedWithCustomError(airdrop, "CampaignNotAllowed");
    });

    it("should revert claim if user has zero allocation", async function () {
      const { user1, token, airdrop } = await loadFixture(deployAirdropFixture);

      const totalAllocated = ethers.parseEther("1000");
      await token.approve(await airdrop.getAddress(), totalAllocated);
      await airdrop.startCompaign(await token.getAddress(), totalAllocated);

      const now = (await ethers.provider.getBlock("latest")).timestamp;
      await airdrop.finalizeCampaign(1, now + 1, 10);

      await network.provider.send("evm_increaseTime", [2 * 86400]);
      await network.provider.send("evm_mine");

      await expect(airdrop.connect(user1).claim(1, ethers.parseEther("50")))
        .to.be.revertedWithCustomError(airdrop, "AlreadyClaimed");
    });

    it("should revert uploadParticipants if allocation exceeds totalAllocated", async function () {
      const { user1, token, airdrop } = await loadFixture(deployAirdropFixture);

      const totalAllocated = ethers.parseEther("100");
      await token.approve(await airdrop.getAddress(), totalAllocated);
      await airdrop.startCompaign(await token.getAddress(), totalAllocated);

      const participants = [{ user: user1.address, amount: ethers.parseEther("101"), campaignId: 1 }];

      await expect(airdrop.uploadParticipants(participants))
        .to.be.revertedWithCustomError(airdrop, "InvalidDistributionSum");
    });

    it("should not allow to claim more than vested amount (TooManyForWitdraw)", async function () {
      const { user1, token, airdrop } = await loadFixture(deployAirdropFixture);

      const totalAllocated = ethers.parseEther("1000");
      await token.approve(await airdrop.getAddress(), totalAllocated);
      await airdrop.startCompaign(await token.getAddress(), totalAllocated);

      const participants = [{ user: user1.address, amount: ethers.parseEther("100"), campaignId: 1 }];
      await airdrop.uploadParticipants(participants);

      const now = (await ethers.provider.getBlock("latest")).timestamp;
      await airdrop.finalizeCampaign(1, now + 1, 1);

      await network.provider.send("evm_increaseTime", [2 * 86400]);
      await network.provider.send("evm_mine");

      await expect(airdrop.connect(user1).claim(1, ethers.parseEther("200")))
        .to.be.revertedWithCustomError(airdrop, "TooManyForWitdraw");
    });

    it("should allow partial claims and update balances properly", async function () {
      const { user1, token, airdrop } = await loadFixture(deployAirdropFixture);

      const totalAllocated = ethers.parseEther("1000");
      await token.approve(await airdrop.getAddress(), totalAllocated);
      await airdrop.startCompaign(await token.getAddress(), totalAllocated);

      const participants = [{ user: user1.address, amount: ethers.parseEther("100"), campaignId: 1 }];
      await airdrop.uploadParticipants(participants);

      const now = (await ethers.provider.getBlock("latest")).timestamp;
      await airdrop.finalizeCampaign(1, now + 1, 1);

      await network.provider.send("evm_increaseTime", [2 * 86400]);
      await network.provider.send("evm_mine");

      const beforeBalance = await token.balanceOf(user1.address);

      await airdrop.connect(user1).claim(1, ethers.parseEther("30"));

      const afterBalance1 = await token.balanceOf(user1.address);
      expect(afterBalance1 - beforeBalance).to.equal(ethers.parseEther("30"));

      await airdrop.connect(user1).claim(1, ethers.parseEther("70"));

      const afterBalance2 = await token.balanceOf(user1.address);
      expect(afterBalance2 - beforeBalance).to.equal(ethers.parseEther("100"));
    });

    it("should emit DestributionChanged when updating existing participant", async function () {
        const { user1, token, airdrop } = await loadFixture(deployAirdropFixture);
      
        const totalAllocated = ethers.parseEther("1000");
        await token.approve(await airdrop.getAddress(), totalAllocated);
        await airdrop.startCompaign(await token.getAddress(), totalAllocated);
      
        const participants1 = [{ user: user1.address, amount: ethers.parseEther("100"), campaignId: 1 }];
        await airdrop.uploadParticipants(participants1);

        const participants2 = [{ user: user1.address, amount: ethers.parseEther("200"), campaignId: 1 }];
        
        await expect(airdrop.uploadParticipants(participants2))
          .to.emit(airdrop, "DestributionChanged")
          .withArgs(user1.address, ethers.parseEther("200"));
    });

    it("should handle zero duration in finalizeCampaign", async function () {
        const { token, airdrop } = await loadFixture(deployAirdropFixture);
      
        const totalAllocated = ethers.parseEther("1000");
        await token.approve(await airdrop.getAddress(), totalAllocated);
        await airdrop.startCompaign(await token.getAddress(), totalAllocated);
      
        const now = (await ethers.provider.getBlock("latest")).timestamp;
        
        await expect(airdrop.finalizeCampaign(1, now + 10, 0))
          .to.not.be.reverted;
      
        const campaign = await airdrop.campaigns(1);
        expect(campaign.vestingEnd).to.equal(campaign.vestingStart);
    });

    it("should allow full claim after vesting period ends", async function () {
        const { user1, token, airdrop } = await loadFixture(deployAirdropFixture);
      
        const totalAllocated = ethers.parseEther("1000");
        await token.approve(await airdrop.getAddress(), totalAllocated);
        await airdrop.startCompaign(await token.getAddress(), totalAllocated);
      
        const participants = [{ user: user1.address, amount: ethers.parseEther("100"), campaignId: 1 }];
        await airdrop.uploadParticipants(participants);
      
        const now = (await ethers.provider.getBlock("latest")).timestamp;
        await airdrop.finalizeCampaign(1, now + 1, 1);
      
        await network.provider.send("evm_increaseTime", [2 * 86400]);
        await network.provider.send("evm_mine");
      
        const beforeBalance = await token.balanceOf(user1.address);
        await airdrop.connect(user1).claim(1, ethers.parseEther("100"));
        const afterBalance = await token.balanceOf(user1.address);
      
        expect(afterBalance - beforeBalance).to.equal(ethers.parseEther("100"));
        expect(await airdrop.campaignDistribution(1, user1.address)).to.equal(0);
    });

    it("should handle multiple partial claims during vesting", async function () {
        const { user1, token, airdrop } = await loadFixture(deployAirdropFixture);
      
        const totalAllocated = ethers.parseEther("1000");
        await token.approve(await airdrop.getAddress(), totalAllocated);
        await airdrop.startCompaign(await token.getAddress(), totalAllocated);
      
        const participants = [{ user: user1.address, amount: ethers.parseEther("100"), campaignId: 1 }];
        await airdrop.uploadParticipants(participants);
      
        const now = (await ethers.provider.getBlock("latest")).timestamp;
        await airdrop.finalizeCampaign(1, now + 1, 10); 
      
        await network.provider.send("evm_increaseTime", [2 * 86400]);
        await network.provider.send("evm_mine");
        await airdrop.connect(user1).claim(1, ethers.parseEther("20"));
    
        await network.provider.send("evm_increaseTime", [5 * 86400]);
        await network.provider.send("evm_mine");
        await airdrop.connect(user1).claim(1, ethers.parseEther("50"));
      
        await network.provider.send("evm_increaseTime", [3 * 86400]);
        await network.provider.send("evm_mine");
        await airdrop.connect(user1).claim(1, ethers.parseEther("30"));
      
        expect(await airdrop.campaignDistribution(1, user1.address)).to.equal(0);
    });

    it("should revert when non-owner tries to start campaign", async function () {
        const { user1, token, airdrop } = await loadFixture(deployAirdropFixture);
      
        const totalAllocated = ethers.parseEther("1000");
        await token.approve(await airdrop.getAddress(), totalAllocated);
        
        await expect(airdrop.connect(user1).startCompaign(await token.getAddress(), totalAllocated))
          .to.be.reverted;
    });
      
    it("should revert when non-owner tries to upload participants", async function () {
        const { user1, token, airdrop } = await loadFixture(deployAirdropFixture);
      
        const totalAllocated = ethers.parseEther("1000");
        await token.approve(await airdrop.getAddress(), totalAllocated);
        await airdrop.startCompaign(await token.getAddress(), totalAllocated);
      
        const participants = [{ user: user1.address, amount: ethers.parseEther("100"), campaignId: 1 }];
        
        await expect(airdrop.connect(user1).uploadParticipants(participants))
          .to.be.reverted;
    });

    it("should return correct campaign state", async function () {
        const { token, airdrop } = await loadFixture(deployAirdropFixture);
      
        const totalAllocated = ethers.parseEther("1000");
        await token.approve(await airdrop.getAddress(), totalAllocated);
        await airdrop.startCompaign(await token.getAddress(), totalAllocated);
      
        let campaign = await airdrop.campaigns(1);
        expect(campaign.finalized).to.be.false;
        expect(campaign.totalAllocated).to.equal(totalAllocated);
      
        const now = (await ethers.provider.getBlock("latest")).timestamp;
        await airdrop.finalizeCampaign(1, now + 10, 30);
        
        campaign = await airdrop.campaigns(1);
        expect(campaign.finalized).to.be.true;
        expect(campaign.vestingStart).to.equal(now + 10);
        expect(campaign.vestingEnd).to.equal(now + 10 + (30 * 86400));
    });
  });
});
