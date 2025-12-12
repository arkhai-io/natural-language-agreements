# natural-language-agreements

## Prerequisites

This project depends on the `alkahest` repository, which must be cloned in the same parent directory.

### Setup Instructions

1. **Clone both repositories in the same parent directory:**

```bash
# Navigate to your projects directory
cd ~/Desktop  # or your preferred location

# Clone the alkahest repository
git clone https://github.com/arkhai-io/alkahest.git

# Clone this repository
git clone https://github.com/arkhai-io/natural-language-agreements.git

# Your directory structure should look like:
# parent-directory/
# ├── alkahest/
# │   └── sdks/
# │       └── ts/
# └── natural-language-agreements/
```

2. **Install alkahest dependencies:**

```bash
cd alkahest
bun install
cd ..
```

3. **Install this project's dependencies:**

```bash
cd natural-language-agreements
bun install
```

4. **Install the `nla` CLI globally (optional but recommended):**

```bash
# Link the CLI to make it available globally
bun link

# Now you can use 'nla' from anywhere!
nla help
```

> **Note:** If you don't install globally, you can still use the CLI with `bun run cli/index.ts` instead of `nla`.

## Quick Start

### Option 1: Automated Setup (Easiest - 1 command!)

Set your OpenAI API key and run everything:

```bash
export OPENAI_API_KEY=sk-your-key-here
nla dev
```

This will:
- ✅ Check all prerequisites
- ✅ Start Anvil (local blockchain)
- ✅ Deploy all contracts
- ✅ Deploy and distribute mock ERC20 tokens
- ✅ Start the oracle
- ✅ Ready to test!

To stop everything:
```bash
nla stop
```

> **Note:** If you haven't installed the CLI globally yet, run `bun link` first, or use `bun run cli/index.ts dev` instead.

### Option 2: Manual Setup (Step by Step)

#### 1. Start Local Blockchain

```bash
# Terminal 1: Start Anvil
anvil
```

#### 2. Deploy Contracts

```bash
# Terminal 2: Deploy to localhost
export OPENAI_API_KEY=sk-your-key-here
nla deploy
```

This creates `cli/deployments/localhost.json` with all contract addresses.

#### 3. Start Oracle

```bash
# Terminal 2 (or 3): Start oracle
nla start-oracle
```


Watch the oracle terminal - you'll see it process arbitration requests in real-time!

## CLI Tools

The `nla` CLI provides a unified interface for all Natural Language Agreement operations.

### Installation

To use the `nla` command globally:

```bash
# From the natural-language-agreements directory
bun link

# Verify installation
nla help
```

**Alternative (without global install):**
```bash
# Use the CLI directly
bun run cli/index.ts help

# Or use npm scripts
bun run setup    # Same as: nla dev
bun run deploy   # Same as: nla deploy
```

For a complete guide to all CLI commands and options, see [CLI Documentation](cli/README.md).

### Quick CLI Examples

```bash
# Create an escrow
nla escrow:create \
  --demand "The sky is blue" \
  --amount 10 \
  --token 0xa513e6e4b8f2a923d98304ec87f64353c4d5c853 \
  --oracle 0x70997970C51812dc3A010C7d01b50e0d17dc79C8

# Fulfill an escrow
nla escrow:fulfill \
  --escrow-uid 0x... \
  --fulfillment "The sky appears blue today" \
  --oracle 0x70997970C51812dc3A010C7d01b50e0d17dc79C8

# Check escrow status
nla escrow:status --escrow-uid 0x...

# Collect approved escrow
nla escrow:collect \
  --escrow-uid 0x... \
  --fulfillment-uid 0x...
```

## Deployment to Other Networks

### Sepolia Testnet

```bash
# 1. Get Sepolia ETH from faucet
# 2. Set your keys
export DEPLOYER_PRIVATE_KEY=0x...
export ORACLE_PRIVATE_KEY=0x...
export OPENAI_API_KEY=sk-...

# 3. Deploy
nla deploy sepolia https://sepolia.infura.io/v3/YOUR-KEY

# 4. Start oracle
nla start-oracle sepolia
```

### Mainnet

```bash
# ⚠️ PRODUCTION - Be careful!
export DEPLOYER_PRIVATE_KEY=0x...
export ORACLE_PRIVATE_KEY=0x...
export OPENAI_API_KEY=sk-...

# Deploy
nla deploy mainnet https://mainnet.infura.io/v3/YOUR-KEY

# Start oracle (consider running as a service)
nla start-oracle mainnet
```

## Available Commands

The `nla` CLI provides unified access to all functionality:

```bash
nla dev                       # Complete local setup (all-in-one)
nla deploy [network] [rpc]    # Deploy contracts to network
nla start-oracle [network]    # Start oracle for network
nla stop                      # Stop all services

nla escrow:create [options]   # Create a new escrow
nla escrow:fulfill [options]  # Fulfill an existing escrow
nla escrow:collect [options]  # Collect an approved escrow
nla escrow:status [options]   # Check escrow status

nla help                      # Show help
```

**NPM Scripts (alternative):**
```bash
bun run setup                 # Same as: nla dev
bun run deploy                # Same as: nla deploy
bun run oracle                # Same as: nla start-oracle
bun run stop                  # Same as: nla stop
```

## Monitoring

### View Oracle Logs

```bash
# If using systemd
sudo journalctl -u nla-oracle -f

# If using nohup
tail -f oracle.log

# If using Anvil
tail -f anvil.log
```

### Check Oracle Status

```bash
# Check if oracle is running
ps aux | grep "bun run oracle"

# Check if Anvil is running
lsof -i :8545
```

## Usage

### Running Tests

```bash
bun test
```

### Development Mode

To run:

```bash
bun run index.ts
```

## Development

This project was created using `bun init` in bun v1.2.20. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Project Structure

```
natural-language-agreements/
├── cli/                          # CLI tools and server components
│   ├── index.ts                  # Main CLI entry point (nla command)
│   ├── README.md                 # CLI documentation
│   ├── client/                   # User-facing escrow tools
│   │   ├── create-escrow.ts      # Create escrow CLI
│   │   ├── fulfill-escrow.ts     # Fulfill escrow CLI
│   │   └── collect-escrow.ts     # Collect escrow CLI
│   ├── server/                   # Server-side components
│   │   ├── deploy.ts             # Contract deployment script
│   │   └── oracle.ts             # Oracle service
│   ├── scripts/                  # Shell scripts for orchestration
│   │   ├── dev.sh                # Development environment setup
│   │   ├── deploy.sh             # Deployment wrapper
│   │   ├── start-oracle.sh       # Oracle starter
│   │   └── stop.sh               # Cleanup script
│   └── deployments/              # Deployment addresses (generated)
│       ├── localhost.json
│       ├── sepolia.json
│       └── mainnet.json
├── clients/
│   └── nla.ts                    # Natural Language Agreement client library
├── tests/
│   ├── nla.test.ts               # Basic tests
│   └── nlaOracle.test.ts         # Oracle arbitration tests
├── index.ts                      # Development entry point
├── package.json
└── README.md
```

## Troubleshooting

### "Cannot find module 'alkahest-ts'"
- Ensure alkahest is cloned in the parent directory
- Run `bun install` in both alkahest and this project

### "Deployer has no ETH"
- Fund your deployer account before running deployment
- For testnets, use a faucet

### "Oracle not detecting arbitration requests"
- Verify RPC URL is correct and accessible
- Check that EAS contract address matches deployment
- Ensure oracle has ETH for gas
- Check polling interval (try lowering it)

### "OpenAI API errors"
- Verify API key is valid and active
- Check OpenAI usage limits and billing
- Ensure model name is correct (e.g., "gpt-4o")

## Security Notes

⚠️ **Important Security Considerations:**

- Never commit your real private keys to version control
- Use environment variables or secure secret management for production
- The `.env` file is gitignored by default
- The example private key in `.env.example` is from Anvil and should NEVER be used in production
- Ensure your OpenAI API key is kept secure and not exposed in logs or error messages
- Run the oracle in a secure environment with proper access controls
