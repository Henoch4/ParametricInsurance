# Parametric Insurance

Inspect events and policies, purchase cover, and submit claims under the deployed contract’s rules. Payouts require a funded reserve.

## Mainnet status

Contract on BOT Chain mainnet (677): [0x783AD469dFD154Ff90c294994aA880A63815241C](https://scan.botchain.ai/address/0x783AD469dFD154Ff90c294994aA880A63815241C).

The deployed policy contract predates the current source fixes. Transactions are paused in this interface while the replacement is reviewed. Existing policies remain readable; use the contract explorer or a compatible wallet to access the existing contract directly.

## Interface

- Live reads use the configured mainnet address; an unavailable RPC produces an explicit error.
- No seeded financial metrics, synthetic receipts, or assessment traces appear in the product.
- Management actions require proof of the connected account’s owner, creator, oracle, merchant, guardian, or record role. The contract remains the authority.
- Account/network changes invalidate an open transaction review.
- The footer provides BOT Chain and BOTScan homepage links; deployed products also link to their contract.
- Ethers is vendored locally with its license. No CDN script is required for wallet or contract operations.

## Contract interface

`frontend/product.json` uses the deployment-era ABI from the recorded deployment artifacts. The current Solidity source may contain newer fixes; it must not be assumed to match deployed bytecode.

| Action | Contract signature |
|---|---|
| Buy cover | `buyPolicy(uint256,uint256)` |
| Claim your policy | `claimPolicy(uint256)` |
| Create an event (owner only) | `createEvent(string,uint256,address)` |
| Cancel your policy | `refundPolicy(uint256)` |
| Trigger an event | `triggerEvent(uint256)` |

## Run locally

Serve the frontend over HTTP so the browser can load its configuration:

```sh
python -m http.server 8080 --directory frontend
```

Open http://localhost:8080. Only connect a wallet when you intend to use the configured mainnet contract.

## Regression test

```sh
npm install
npm test
```

The test requires Chromium or Edge. Windows defaults to the standard Edge installation; set `BROWSER_PATH` to another Chromium executable when needed. It mocks all chain requests and broadcasts no transactions. Tests cover pending deployment, RPC failure, read-only initialization and missing-wallet handling.

## Deployment and assessment

Update `frontend/product.json` only after confirming the new contract's network, bytecode and ABI. Do not substitute placeholder addresses or remove truthful limitations. Operator-wallet testing proves technical activity, not independent users. Official social accounts, launch posts, independent users and continuous operation require separate evidence.
