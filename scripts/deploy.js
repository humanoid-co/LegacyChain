const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [owner, beneficiary, guardian1, guardian2, guardian3] = await hre.ethers.getSigners();
  const Vault = await hre.ethers.getContractFactory("LegacyVault");
  const vault = await Vault.deploy(beneficiary.address, [guardian1.address, guardian2.address, guardian3.address]);
  await vault.waitForDeployment();
  const deposit = hre.ethers.parseEther("5.0");
  const tx = await owner.sendTransaction({ to: await vault.getAddress(), value: deposit });
  await tx.wait();

  const deployment = {
    contractAddress: await vault.getAddress(),
    chainId: 31337,
    owner: owner.address,
    beneficiary: beneficiary.address,
    guardians: [guardian1.address, guardian2.address, guardian3.address],
    fundedWithEth: "5.0"
  };
  fs.writeFileSync(path.join(__dirname, "..", "deployment.json"), JSON.stringify(deployment, null, 2));
  fs.writeFileSync(
    path.join(__dirname, "..", "frontend", "src", "deployment.json"),
    JSON.stringify(deployment, null, 2)
  );
  const artifact = require(path.join(__dirname, "..", "artifacts", "contracts", "LegacyVault.sol", "LegacyVault.json"));
  fs.writeFileSync(
    path.join(__dirname, "..", "frontend", "src", "legacyVaultAbi.json"),
    JSON.stringify(artifact.abi, null, 2)
  );
  console.log("LegacyVault deployed and funded:");
  console.log(JSON.stringify(deployment, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
