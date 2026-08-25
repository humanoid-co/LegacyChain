const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LegacyVault demo flow", function () {
  async function deployVault() {
    const [owner, beneficiary, g1, g2, g3] = await ethers.getSigners();
    const Vault = await ethers.getContractFactory("LegacyVault");
    const vault = await Vault.deploy(beneficiary.address, [g1.address, g2.address, g3.address]);
    await owner.sendTransaction({ to: await vault.getAddress(), value: ethers.parseEther("1") });
    return { vault, owner, beneficiary, g1, g2, g3 };
  }
  it("releases its funded ETH after legacy mode and 2 guardian votes", async function () {
    const { vault, owner, beneficiary, g1, g2 } = await deployVault();
    await expect(vault.connect(owner).setLifeScore(50)).to.emit(vault, "LifeStateTransition");
    await vault.connect(owner).setLifeScore(20);
    await vault.connect(g1).confirmRelease();
    await expect(vault.connect(g2).confirmRelease()).to.emit(vault, "ReleaseEligible");
    await expect(vault.executeRelease()).to.emit(vault, "AssetsReleased");
    expect(await vault.released()).to.equal(true);
    expect(await ethers.provider.getBalance(await vault.getAddress())).to.equal(0n);
    expect(beneficiary.address).to.be.properAddress;
  });
});
