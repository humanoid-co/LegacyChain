# LegacyChain — local hackathon prototype

LegacyChain is a **demo-only** digital legacy flow. A local Solidity vault holds test ETH, a frontend Life Score simulation triggers state transitions, and two of three local demo guardians unlock an on-chain release.

> Deliberate demo shortcuts: no authentication, no database, no real biometrics/AI, no key custody, public Hardhat demo accounts, and no real asset integrations. Never deploy or fund this contract on a public network.

## Prerequisites

- Node.js 18+ (Node 20 LTS recommended)
- `npm`

Install dependencies once while online; `node_modules` then lets the actual presentation run entirely locally.

```powershell
npm install
Set-Location frontend
npm install
Set-Location ..
```

## Stage 1 — contract: compile and test

From the project root:

```powershell
npm run test
```

Expected: `1 passing`. This test deploys a temporary vault, deposits test ETH, forces WARNING then LEGACY MODE, submits two guardian confirmations, and releases the balance.

## Stage 2 — local chain: deploy and verify

Open a first PowerShell window at the project root and leave this running:

```powershell
npm run chain
```

In a second PowerShell window at the project root:

```powershell
npm run deploy
npm run verify:contract
```

Expected verification output: Life score `100`, Life state `0` (ALIVE), and vault balance `5.0` ETH. Deployment automatically copies the fresh contract address and ABI to the frontend.

## Stage 3 — dashboard: run and verify

In a third PowerShell window:

```powershell
Set-Location frontend
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The status badge should say `Local Hardhat · Connected` and show `5.00 ETH`.

For a production-style compilation check instead:

```powershell
Set-Location frontend
npm run build
```

## Demo script (about 30 seconds)

1. Start the local chain, deploy, and start the dashboard as above.
2. Click **SIMULATE MY INACTIVITY**. The UI makes a real `setLifeScore(55)` transaction on simulated Day 15, then `setLifeScore(25)` on Day 25.
3. At Day 30, click **Confirm Release** on Guardian 1. At Day 33, click it on Guardian 2. The buttons derive the local Hardhat guardian wallets only for this demo.
4. Once the UI shows `2 / 2 confirmed`, click **Day 37 — Execute On-chain Release**. The `Assets Released` screen displays the local-chain transaction hash.
5. Click **I'm Active — Check In** any time before release to call `checkIn()`, reset the score to 100, and clear demo guardian votes so the lifecycle can be replayed.

The dashboard both listens for contract events over local JSON-RPC and rereads on-chain state after transactions. The timeline is not a fake animation: every meaningful milestone submits or observes a transaction on `http://127.0.0.1:8545`.

## Project layout

```text
contracts/LegacyVault.sol      Solidity vault and state machine
scripts/deploy.js              Local deployment + 5 ETH test funding
scripts/verify-demo.js         Read-only post-deployment verification
test/LegacyVault.js            End-to-end contract test
frontend/                      React + Vite + Tailwind dashboard
```

## Resetting the demo

Stop the Hardhat node with `Ctrl+C`, then start `npm run chain` and run `npm run deploy` again. A fresh local node resets every account and contract state.

## Render deployment (desktop + mobile)

This repository includes `render.yaml`. On Render it runs as one web service: `server.js` starts a private, ephemeral Hardhat node, deploys a fresh demo vault, serves the responsive Vite build, and proxies browser contract calls to `/rpc`. Visitors therefore do not need MetaMask, a local node, or any installation.

1. Push this repository to GitHub.
2. In Render, create a **Blueprint** from the repository and select `render.yaml`.
3. Select the `starter` plan (or a larger paid instance) for continuous 24/7 availability. Free instances may spin down.
4. Open the generated HTTPS URL on a phone or desktop. Each service restart creates a new demo chain and resets the vault to 5 test ETH.

This hosted chain is still intentionally a public demo sandbox; its well-known Hardhat wallets and test ETH make it unsafe for any real assets.
