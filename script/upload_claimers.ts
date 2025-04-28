import { ethers } from "hardhat";
import csv from "csv-parser";
import fs from "fs-extra";

async function upload_CSV(csvPath: string, contractAddress: string, batchSize = 200) {
    try {
        const [owner] = await ethers.getSigners();
        console.log(`Address from: ${owner.address}`);

        const Airdrop = await ethers.getContractFactory("Airdrop");
        const airdrop = Airdrop.attach(contractAddress);

        console.log(`Connected to contract: ${airdrop.target}`);

        const records: any[] = []

        csv(['user', 'amount', 'campaignId']);

        fs.createReadStream(csvPath)
            .pipe(csv())
            .on('data', (data: any) => records.push(data))
            .on('end', () => {
                console.log(`Parsed ${records.length} entries from ${csvPath}.`);
            })

        let batch: any[] = [];

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

                const tx = await airdrop.uploadParticipants(batch, {
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

// npx hardhat run scripts/upload_csv.ts --network sepolia
upload_CSV("./data/recipients.csv", "0xYourDeployedAirdropAddressHere");

echo "# testovoey_lumia" >> README.md
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/Verefrint/testovoey_lumia.git
git push -u origin main
