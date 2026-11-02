# Parametric Insurance — Cover that Triggers Itself

> Coverage that pays out when a real-world parameter crosses a threshold - weather data feeds trigger cover without a claim form, adjuster, or waiting period.

## What it does

Coverage that pays out when a real-world parameter crosses a threshold - weather data feeds trigger cover without a claim form, adjuster, or waiting period. Wallet actions call the contract directly; the demo section replays recorded mainnet transactions.

## Contract

| | |
|---|---|
| File | `contracts/ParametricInsurance.sol` |
| Contract name | `ParametricInsurance` (inherits `ReentrancyGuard, Ownable`) |
| Solidity | `^0.8.20` |
| State functions | 10 (of which 1 payable) |
| Deployed (mainnet 677) | `0x783AD469dFD154Ff90c294994aA880A63815241C` |

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

- **Wallet connection** - injected EIP-1193 provider (MetaMask, Coinbase Wallet, or a wallet browser); the connect button reflects the connected address and network
- **Web3 library** - ethers.js v6 UMD build (`BrowserProvider`, `Contract`, `parseEther`)
- **Animation** - GSAP 3 + ScrollTrigger (`expo.out` entrances, `prefers-reduced-motion` fallback renders content instantly)
- **Zero build step** - single `index.html` with CDN `<script>` tags; no bundler, no framework runtime
- **Accessibility** - labelled controls, `aria-live` status regions, focus-visible styles, button busy states

## Run it locally

```bash
git clone https://github.com/Henoch4/ParametricInsurance.git
cd ParametricInsurance
# open the frontend directly (no build step)
start frontend/index.html   # Windows
# or serve it if your browser blocks file:// modules:
npx serve frontend
```

> **Note** — the UI reads its deploy target from `CA_MAIN` at the top of the inline script. The demo section replays seven recorded transactions from that contract; it sends nothing on-chain.

## Verify the frontend

```bash
node tests/ui.test.cjs
```

The regression test executes the page's inline runtime against a DOM stub and asserts that the wallet button attaches a handler, missing wallets get a visible toast, the network toggle reaches the wallet, and the demo trace renders and downloads. It needs no browser and no network.