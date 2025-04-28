import { ethers } from "hardhat";

async function startCampaign(
  contractAddress: string,
  tokenAddress: string,
  totalAllocated: bigint,
  gasLimit: number
): Promise<void> {
  const [owner] = await ethers.getSigners();
  console.log(`Owner address: ${owner.address}`);

  const airdrop = await ethers.getContractAt("Airdrop", contractAddress);
  console.log(`Connected to Airdrop contract at: ${await airdrop.getAddress()}`);

  const token = await ethers.getContractAt("IERC20", tokenAddress);
  console.log(`Connected to Token contract at: ${await token.getAddress()}`);

  const tx = await airdrop.startCompaign(
    tokenAddress,
    totalAllocated,
    { gasLimit: gasLimit }
  );

  const receipt = await tx.wait();
  console.log(`Campaign started in tx: ${receipt?.hash}`);

  const campaignId = await airdrop.id();
  console.log(`New campaign ID: ${campaignId}`);
}

await startCampaign(
  "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  ethers.parseEther("1000"),
  8000000
);