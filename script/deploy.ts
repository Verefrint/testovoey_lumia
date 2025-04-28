import {ethers} from "hardhat";

async function deploy(owner: string) {
    try {
        const myContract = await ethers.getContractFactory("Airdrop")
        const contract = await myContract.deploy(owner)
        await contract.waitForDeployment()

        console.log(`contract address: ${await contract.getAddress()}`)
    } catch (error) {
        console.log(error)
    }
}

deploy("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");