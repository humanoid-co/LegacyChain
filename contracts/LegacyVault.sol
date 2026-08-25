// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title LegacyChain demo vault
/// @notice Deliberately simplified for a hackathon demo. Not audited or production-safe.
contract LegacyVault {
    enum LifeState { ALIVE, WARNING, LEGACY_MODE }

    uint8 public constant WARNING_THRESHOLD = 60;
    uint8 public constant LEGACY_THRESHOLD = 30;

    address public immutable owner;
    address payable public immutable beneficiary;
    address[] private guardians;
    mapping(address => bool) public isGuardian;
    mapping(address => bool) public hasConfirmed;

    uint8 public lifeScore = 100;
    LifeState public lifeState = LifeState.ALIVE;
    uint8 public confirmationCount;
    bool public released;

    event LifeStateTransition(LifeState indexed from, LifeState indexed to, uint8 score);
    event CheckIn(address indexed user, uint8 score);
    event LifeScoreUpdated(uint8 score, LifeState state);
    event GuardianConfirmed(address indexed guardian, uint8 confirmations, uint8 required);
    event ReleaseEligible(uint8 confirmations, uint8 required);
    event AssetsReleased(address indexed beneficiary, uint256 amount);
    event DepositReceived(address indexed from, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the demo owner can do this");
        _;
    }

    modifier onlyGuardian() {
        require(isGuardian[msg.sender], "Only a guardian can confirm");
        _;
    }

    constructor(address payable _beneficiary, address[] memory _guardians) {
        require(_beneficiary != address(0), "Beneficiary required");
        require(_guardians.length == 3, "Demo requires exactly 3 guardians");
        owner = msg.sender;
        beneficiary = _beneficiary;
        for (uint256 i = 0; i < _guardians.length; i++) {
            address guardian = _guardians[i];
            require(guardian != address(0), "Invalid guardian");
            require(!isGuardian[guardian], "Duplicate guardian");
            isGuardian[guardian] = true;
            guardians.push(guardian);
        }
    }

    receive() external payable {
        emit DepositReceived(msg.sender, msg.value);
    }

    function getGuardians() external view returns (address[] memory) {
        return guardians;
    }

    function checkIn() external onlyOwner {
        require(!released, "Vault already released");
        LifeState previous = lifeState;
        lifeScore = 100;
        lifeState = LifeState.ALIVE;
        // Resetting votes is a demo convenience so the presenter can replay the lifecycle.
        confirmationCount = 0;
        for (uint256 i = 0; i < guardians.length; i++) hasConfirmed[guardians[i]] = false;
        emit CheckIn(msg.sender, lifeScore);
        emit LifeScoreUpdated(lifeScore, lifeState);
        if (previous != lifeState) emit LifeStateTransition(previous, lifeState, lifeScore);
    }

    /// @dev DEMO ONLY: production systems would derive this from verified signals.
    function setLifeScore(uint8 score) external onlyOwner {
        require(!released, "Vault already released");
        require(score <= 100, "Score must be 0-100");
        LifeState previous = lifeState;
        lifeScore = score;
        if (score < LEGACY_THRESHOLD) {
            lifeState = LifeState.LEGACY_MODE;
        } else if (score < WARNING_THRESHOLD) {
            lifeState = LifeState.WARNING;
        } else {
            lifeState = LifeState.ALIVE;
        }
        emit LifeScoreUpdated(score, lifeState);
        if (previous != lifeState) emit LifeStateTransition(previous, lifeState, score);
    }

    function confirmRelease() external onlyGuardian {
        require(!released, "Vault already released");
        require(lifeState == LifeState.LEGACY_MODE, "Not eligible for guardian vote");
        require(!hasConfirmed[msg.sender], "Guardian already confirmed");
        hasConfirmed[msg.sender] = true;
        confirmationCount += 1;
        emit GuardianConfirmed(msg.sender, confirmationCount, 2);
        if (confirmationCount >= 2) emit ReleaseEligible(confirmationCount, 2);
    }

    function executeRelease() external {
        require(!released, "Vault already released");
        require(lifeState == LifeState.LEGACY_MODE, "Not in legacy mode");
        require(confirmationCount >= 2, "Need 2 guardian confirmations");
        released = true;
        uint256 amount = address(this).balance;
        (bool sent, ) = beneficiary.call{value: amount}("");
        require(sent, "ETH transfer failed");
        emit AssetsReleased(beneficiary, amount);
    }
}
