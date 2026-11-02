# Parametric Insurance — Cover that Triggers Itself

> Coverage that pays out when a real-world parameter crosses a threshold - weather data feeds trigger cover without a claim form, adjuster, or waiting period.

## What it does

Coverage that pays out when a real-world parameter crosses a threshold - weather data feeds trigger cover without a claim form, adjuster, or waiting period. The entire lifecycle lives in one contract, every button in the UI calls a real function on it — there is no mock backend.

## Contract

| | |
|---|---|
| File | `contracts/ParametricInsurance.sol` |
| Contract name | `ParametricInsurance` (inherits `ReentrancyGuard, Ownable`) |
| Solidity | `^0.8.20` |
| State functions | 10 (of which 1 payable) |
| Deployed (mainnet 677) | not yet deployed — placeholder `0x000…000` |

### Function surface

| Function | Type | Returns |
|---|---|---|
| `owner` | view | address |
| `setPremiumBps` | write | result / revert |
| `createEvent` | write | uint256 |
| `buyPolicy` | payable | tx receipt |
| `triggerEvent` | write | result / revert |
| `claimPolicy` | write | result / revert |
| `refundPolicy` | write | result / revert |
| `getEvent` | view | Event memory |
| `getPolicy` | view | Policy memory |
| `getPoliciesForEvent` | view | uint256[] memory |

### Events

| Event | Signature |
|---|---|
| `OwnershipTransferred` | (address indexed previousOwner, address indexed newOwner) |
| `PolicyCreated` | (uint256 indexed pid, address indexed holder, uint256 premium, uint256 coverAmount, uint256 eventId) |
| `EventCreated` | (uint256 indexed id, string description, address indexed oracle) |
| `EventTriggered` | (uint256 indexed id) |
| `PolicyClaimed` | (uint256 indexed pid, address indexed holder, uint256 payout) |
| `PolicyRefunded` | (uint256 indexed pid, address indexed holder, uint256 premium) |

## Network

| | |
|---|---|
| Chain | BOT Chain Mainnet (chainId `677`) |
| RPC | `https://rpc.botchain.ai` |
| Explorer | `https://scan.botchain.ai` |
| Native currency | BOT (18 decimals) |
| Testnet | BOT Chain Testnet (chainId `968`) - `https://rpc.bohr.life` |

## Frontend

- **Wallet connection** - [Reown/AppKit](https://reown.com) (Web3Modal v2, inline modal, `subscribeAccount` / `subscribeNetwork`)
- **Web3 library** - ethers.js v6 (`BrowserProvider`, `Contract`, `parseEther`)
- **Animation** - GSAP 3 + ScrollTrigger (`expo.out` entrances, `prefers-reduced-motion` fallback renders content instantly)
- **Zero build step** - single `index.html`, CDN imports via ESM import map; no bundler, no framework runtime
- **Accessibility** - auto-generated `aria-label`s on all binary and form controls, focus-visible styles, button busy states

## Run it locally

```bash
git clone https://github.com/Henoch4/ParametricInsurance.git
cd ParametricInsurance
# open the frontend directly (no build step)
start frontend/index.html   # Windows
# or serve it if your browser blocks file:// modules:
npx serve frontend
```

> **Note** — contract addresses: the UI reads its deploy target from the `CA` constant at the top of the inline script. Until the contract is deployed to mainnet 677, the demo runs against the deterministic sample data built into the page; after deployment, set `CA['677']` to the real address and every button goes live.