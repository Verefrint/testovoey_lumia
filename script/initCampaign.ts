import { ethers } from "hardhat";
import csv from "csv-parser";
import fs from "fs-extra";

async function startCampaign(contractAddress: string, token: string, vestingTime: BigInt, durationInDays: BigInt, totalAllocated: BigInt) {
    try {
        const [owner] = await ethers.getSigners();
        console.log(`Address from: ${owner.address}`);

        const Airdrop = await ethers.getContractFactory("Airdrop");
        const airdrop = Airdrop.attach(contractAddress);

        console.log(`Connected to contract: ${airdrop.target}`);

        const tx = await airdrop.startCompaign(token, vestingTime, durationInDays, totalAllocated, {
            gasLimit: 8_000_000, 
        });

        await tx.wait();

        console.log(`Finished uploading all participants.`);
    } catch (error) {
        console.error(`Error during CSV upload:`, error);
    }
}

// npx hardhat run scripts/upload_csv.ts --network sepolia
startCampaign("adress_c", "address_token", BigInt(123), BigInt(7), BigInt(1000));