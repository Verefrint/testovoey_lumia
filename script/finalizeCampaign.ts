import { ethers } from "hardhat";

async function finalizeCampaign(
  contractAddress: string,
  campaignId: number,
  vestingStartDelay: number,
  durationInDays: number,
  gasLimit: number
): Promise<void> {
  try {
    const [owner] = await ethers.getSigners();
    console.log(`Owner address: ${owner.address}`);

    const airdrop = await ethers.getContractAt("Airdrop", contractAddress);
    console.log(`Connected to Airdrop contract: ${await airdrop.getAddress()}`)

    const currentBlock = await ethers.provider.getBlock("latest");
    const vestingStart = currentBlock!.timestamp + vestingStartDelay;

    console.log(`Finalizing campaign ${campaignId}...`);
    const tx = await airdrop.finalizeCampaign(
      campaignId,
      vestingStart,
      durationInDays,
      { gasLimit: gasLimit }
    );

    const receipt = await tx.wait();
    console.log(`Campaign finalized in tx: ${receipt?.hash}`);

    const campaign = await airdrop.campaigns(campaignId);
    console.log(`Campaign ${campaignId} details:`);
    console.log(`- Finalized: ${campaign.finalized}`);
    console.log(`- Vesting Start: ${new Date(campaign.vestingStart * 1000)}`);
    console.log(`- Vesting End: ${new Date(campaign.vestingEnd * 1000)}`);
    console.log(`- Token: ${campaign.token}`);
    console.log(`- Total Allocated: ${ethers.formatEther(campaign.totalAllocated)}`);
    console.log(`- Total Distributed: ${ethers.formatEther(campaign.totalDistributed)}`);

  } catch (error) {
    console.error("Error finalizing campaign:", error);
    process.exitCode = 1;
  }
}

finalizeCampaign(
  "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  1,
  86400, 
  30,
  8000000
);