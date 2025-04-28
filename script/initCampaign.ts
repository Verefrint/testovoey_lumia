import { ethers } from "hardhat";

async function startCampaign(
  contractAddress: string,
  token: string,
  vestingTime: bigint,
  durationInDays: bigint,
  totalAllocated: bigint
) {
  try {
    const [owner] = await ethers.getSigners();
    console.log(`Address from: ${owner.address}`);

    const Airdrop = await ethers.getContractFactory("Airdrop");
    const airdrop = Airdrop.attach(contractAddress);

    console.log(`Connected to contract: ${airdrop.target}`);

    const tx = await airdrop.startCompaign(
      token,
      vestingTime,
      durationInDays,
      totalAllocated, 
      {
        gasLimit: 8_000_000,
      }
    );

    await tx.wait();

    console.log(`Finished successfully`);
  } catch (error) {
    console.error(`Error:`, error);
  }
}

async function checkId() {
    const Airdrop = await ethers.getContractFactory("Airdrop");
    const airdrop = Airdrop.attach("0x5FbDB2315678afecb367f032d93F642f64180aa3");
    
    try {
        const campaign = await airdrop.id()
        console.log(campaign)
        
    } catch (error) {
        console.log(error)
    }
}

async function main() {
  const blockNumBefore = await ethers.provider.getBlockNumber();
  const blockBefore = await ethers.provider.getBlock(blockNumBefore);
  const timestampBefore = blockBefore!.timestamp + 1000;

  await startCampaign(
    "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    BigInt(timestampBefore),
    BigInt(7),
    BigInt(1000)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});