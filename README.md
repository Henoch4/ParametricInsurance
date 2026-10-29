# Parametric Insurance

**Oracle-triggered cover that settles itself.**

Live on **BOT Chain mainnet (chain ID 677)**.

| | |
|---|---|
| Contract | `0x783AD469dFD154Ff90c294994aA880A63815241C` |
| Network | BOT Chain Mainnet |
| Chain ID | 677 |
| RPC | https://rpc.botchain.ai |
| Explorer | https://scan.botchain.ai/ |
| Website | https://botchain.ai |

## What it does

Buy a policy against a verifiable event. The moment the named oracle triggers the event, every open policy pays out in the same transaction. Premium is 105% of cover, charged once at purchase. If the oracle never fires, a refund window opens 30 days after the trigger timestamp.

## Functions

- `createEvent(description, triggerTimestamp, oracle) — owner only`
- `buyPolicy(eventId, coverAmount) — payable, premium = cover × 1.05`
- `triggerEvent(eventId) — oracle only, settles all open policies`
- `claimPolicy(policyId) — per-policy fallback claim`
- `refundPolicy(policyId) — 30 days after trigger window, if never triggered`

## Frontend

A single self-contained `index.html` — no build step, no bundler. Open it directly or serve the folder statically.

- Wallet connect through any injected EIP-1193 wallet (MetaMask, OKX Wallet).
- If chain 677 is not configured, the page offers to add it (`wallet_addEthereumChain`).
- Every number on the page is read live from the contract over JSON-RPC; nothing is mocked.
- All writes are sent from the connected account and confirmed before the UI refreshes.

```bash
# any static server works
npx serve .
```

## Contract

`contracts/ParametricInsurance.sol` — self-contained Solidity 0.8.20, no external imports. Reentrancy guard and ownership are declared inline so the file compiles standalone with `solc`.

## License

MIT
