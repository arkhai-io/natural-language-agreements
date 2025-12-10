# Quick Start Guide

Get your Natural Language Agreement Oracle running in **under 2 minutes**!

## Prerequisites

- [Bun](https://bun.sh) installed
- [Foundry](https://book.getfoundry.sh/getting-started/installation) installed
- Both `alkahest` and `natural-language-agreements` repos cloned in same parent directory
- OpenAI API key

## One-Command Setup

```bash
export OPENAI_API_KEY=sk-your-key-here
./scripts/dev.sh
```

Done! The oracle is now running and listening for arbitration requests.

**To stop:**
```bash
./scripts/stop.sh
```

## What Just Happened?

The script:
1. ✅ Checked prerequisites
2. ✅ Started Anvil (local blockchain)
3. ✅ Deployed all contracts
4. ✅ Started the oracle

## Test It

In another terminal:
```bash
bun test tests/nlaOracle.test.ts
```

Watch the oracle terminal to see it process the arbitration!

## Manual Steps (Optional)

If you want more control:

```bash
# Terminal 1: Blockchain
anvil

# Terminal 2: Deploy and start oracle
bun run deploy
bun run oracle

# Terminal 3: Test
bun test tests/nlaOracle.test.ts
```

## Deploy to Testnet

```bash
# Get Sepolia ETH from faucet first
export DEPLOYER_PRIVATE_KEY=0x...
bun run setups/deploy.ts --network sepolia --rpc-url https://sepolia.infura.io/v3/YOUR-KEY

# Start oracle
export ORACLE_PRIVATE_KEY=0x...
export OPENAI_API_KEY=sk-...
bun run setups/oracle.ts sepolia
```

## Need Help?

- Full docs: [README.md](README.md)
- Example test: `tests/nlaOracle.test.ts`
