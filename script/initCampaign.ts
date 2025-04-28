import { ethers } from "hardhat";

async function startCampaign(
  contractAddress: string,
  tokenAddress: string,
  totalAllocated: bigint,
  gasLimit: number
): Promise<void> {
  const [owner] = await ethers.getSigners();
  console.log(`Owner address: ${owner.address}`);

  // Get token contract and approve airdrop to spend tokens
  const token = await ethers.getContractAt("TestToken", tokenAddress);
  console.log(`Connected to Token contract at: ${await token.getAddress()}`);

  console.log(`Approving Airdrop contract to spend ${ethers.formatEther(totalAllocated)} tokens...`);
  const approveTx = await token.approve(contractAddress, totalAllocated);
  await approveTx.wait();
  console.log(`Approval confirmed in tx: ${approveTx.hash}`);

  // Start campaign
  const airdrop = await ethers.getContractAt("Airdrop", contractAddress);
  console.log(`Connected to Airdrop contract at: ${await airdrop.getAddress()}`);

  const tx = await airdrop.startCampaign(
    tokenAddress,
    totalAllocated,
    { gasLimit: gasLimit }
  );

  const receipt = await tx.wait();
  console.log(`Campaign started in tx: ${receipt?.hash}`);

  const campaignId = await airdrop.id();
  console.log(`New campaign ID: ${campaignId}`);

  // Verify token balance was transferred
  const airdropBalance = await token.balanceOf(contractAddress);
  console.log(`Airdrop contract token balance: ${ethers.formatEther(airdropBalance)}`);
}

await startCampaign(
  "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  ethers.parseEther("1000"),
  8000000
);