const hre = require("hardhat");
const deployment = require("../deployment.json");

async function main() {
  const vault = await hre.ethers.getContractAt("LegacyVault", deployment.contractAddress);
  console.log("Contract:", deployment.contractAddress);
  console.log("Life score:", (await vault.lifeScore()).toString());
  console.log("Life state (0=ALIVE):", (await vault.lifeState()).toString());
  console.log("Vault balance ETH:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployment.contractAddress)));
  console.log("Guardians:", await vault.getGuardians());
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
