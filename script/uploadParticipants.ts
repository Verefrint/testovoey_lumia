import { ethers } from "hardhat";
import csv from "csv-parser";
import fs from "fs-extra";
import { AirdropParticipantStructOutput } from "../typechain-types/contracts/Airdrop";

async function upload_CSV(csvPath: string, contractAddress: string, batchSize: number, gasLimit: number) {
    try {
        const [owner] = await ethers.getSigners();
        console.log(`Address from: ${owner.address}`);

        const Airdrop = await ethers.getContractFactory("Airdrop");
        const airdrop = Airdrop.attach(contractAddress);

        console.log(`Connected to contract: ${airdrop.target}`);

        const records: AirdropParticipantStructOutput[] = []

        csv(['user', 'amount', 'campaignId']);

        fs.createReadStream(csvPath)
            .pipe(csv())
            .on('data', (data: AirdropParticipantStructOutput) => records.push(data))
            .on('end', () => {
                console.log(`Parsed ${records.length} entries from ${csvPath}.`);
            })

        let batch: AirdropParticipantStructOutput [] = [];

        for (let i = 0; i < records.length; i++) {

            const user = records[i].user.trim().toString();
            const amount = BigInt(ethers.parseUnits(records[i].amount.toString(), 18));
            const campaignId = BigInt(ethers.parseUnits(records[i].campaignId.toString(), 18))

            batch.push({
                user,
                amount,
                campaignId,
            });

            if (batch.length === batchSize || i === records.length - 1) {
                console.log(`Uploading batch with ${batch.length} participants...`);

                const tx = await airdrop.uploadParticipants(batch, batchSize, {
                    gasLimit: 8_000_000, 
                });

                await tx.wait();

                console.log(`Uploaded batch ${Math.floor(i / batchSize) + 1}`);
                batch = []
            }
        }

        console.log(`Finished uploading all participants.`);
    } catch (error) {
        console.error(`Error during CSV upload:`, error);
    }
}

upload_CSV("./script/test.csv", "0x5FbDB2315678afecb367f032d93F642f64180aa3", 20, 8000000);