# Natural Language Agreement CLI Tools

User-friendly command-line tools to interact with Natural Language Agreement escrows.

## Installation

First, install the CLI globally:

```bash
bun link
```

Now you can use `nla` from anywhere in your terminal!

## Unified CLI

The `nla` command provides a unified interface for all escrow operations:

```bash
nla <command> [options]
```

**Available Commands:**
- `dev` - Start local development environment (Anvil + Deploy + Oracle)
- `escrow:create` - Create a new escrow with natural language demand
- `escrow:fulfill` - Fulfill an existing escrow
- `escrow:collect` - Collect an approved escrow
- `escrow:status` - Check the status of an escrow
- `help` - Display help message

## Quick Start

### Start Development Environment

The easiest way to get started is with the `dev` command:

```bash
nla dev
```

This will:
1. Start Anvil (local Ethereum node)
2. Deploy all contracts
3. Deploy mock ERC20 tokens and distribute them
4. Start the oracle listening for arbitration requests

**Note:** Keep this terminal open - it runs the oracle. Open a new terminal for creating escrows.

### Prerequisites

Before running `nla dev`, set your OpenAI API key:

```bash
export OPENAI_API_KEY=sk-your-key-here
```

For creating escrows, also set:

```bash
export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### 1. Create an Escrow

```bash
nla escrow:create \
  --demand "The sky is blue" \
  --amount 10 \
  --token 0xa513e6e4b8f2a923d98304ec87f64353c4d5c853 \
  --oracle 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
```

> **Note:** Get the token address from the deployment output. The deployment creates 3 test tokens (TSTA, TSTB, TSTC) and distributes 10,000 of each to all test accounts.

**Save the Escrow UID** from the output!

### 2. Fulfill the Escrow

Switch to a different account:

```bash
export PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

nla escrow:fulfill \
  --escrow-uid 0x... \
  --fulfillment "The sky appears blue today" \
  --oracle 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
```

**Save the Fulfillment UID** from the output!

### 3. Check Status

Monitor the escrow and arbitration progress:

```bash
nla escrow:status \
  --escrow-uid 0x... \
  --deployment ./cli/deployments/localhost.json
```

This will show:
- Escrow details (demand, oracle, recipient)
- All fulfillments
- Arbitration decisions (approved/rejected)

### 4. Collect the Escrow

If approved, collect the escrowed tokens:

```bash
nla escrow:collect \
  --escrow-uid 0x... \
  --fulfillment-uid 0x...
```

## Commands

### Create Escrow

```bash
nla escrow:create [options]

Options:
  --demand <text>              Natural language demand (required)
  --amount <number>            Amount of tokens to escrow (required)
  --token <address>            ERC20 token address (required)
  --oracle <address>           Oracle address (required)
  --private-key <key>          Your private key (or set PRIVATE_KEY env var)
  --deployment <path>          Deployment file (default: ./cli/deployments/localhost.json)
  --rpc-url <url>              RPC URL (default: from deployment)
  --help, -h                   Show help
```

### Fulfill Escrow

```bash
nla escrow:fulfill [options]

Options:
  --escrow-uid <uid>           Escrow UID to fulfill (required)
  --fulfillment <text>         Your fulfillment text (required)
  --oracle <address>           Oracle address (required)
  --private-key <key>          Your private key (or set PRIVATE_KEY env var)
  --deployment <path>          Deployment file (default: ./cli/deployments/localhost.json)
  --rpc-url <url>              RPC URL (default: from deployment)
  --help, -h                   Show help
```

### Collect Escrow

```bash
nla escrow:collect [options]

Options:
  --escrow-uid <uid>           Escrow UID (required)
  --fulfillment-uid <uid>      Approved fulfillment UID (required)
  --private-key <key>          Your private key (or set PRIVATE_KEY env var)
  --deployment <path>          Deployment file (default: ./cli/deployments/localhost.json)
  --rpc-url <url>              RPC URL (default: from deployment)
  --help, -h                   Show help
```

### Check Status

```bash
nla escrow:status [options]

Options:
  --escrow-uid <uid>           Escrow UID to check (required)
  --deployment <path>          Deployment file (default: ./cli/deployments/localhost.json)
  --rpc-url <url>              RPC URL (default: from deployment)
  --help, -h                   Show help
```

## Default Anvil Accounts

For local testing, use these default Anvil accounts:

```bash
# Account #0 (Alice - Escrow Creator)
Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Account #1 (Bob - Oracle & Fulfiller)
Address: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
Private Key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

# Account #2 (Charlie - Alternative user)
Address: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
Private Key: 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
```

## Environment Variables

Instead of using `--private-key` every time, set:

```bash
export PRIVATE_KEY=0x...
export OPENAI_API_KEY=sk-...  # Required for oracle
```

## Example Workflow

```bash
# Terminal 1: Start the development environment
nla dev

# Note the token addresses from the deployment output!
# Example: Token A (TSTA): 0xa513e6e4b8f2a923d98304ec87f64353c4d5c853

# Terminal 2: Set your private key and create an escrow (as Alice)
export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

nla escrow:create \
  --demand "Deliver package by Friday" \
  --amount 100 \
  --token 0xa513e6e4b8f2a923d98304ec87f64353c4d5c853 \
  --oracle 0x70997970C51812dc3A010C7d01b50e0d17dc79C8

# Save the escrow UID, e.g.: 0xd9e1402e96c2f7a64e60bf53a45445f7254e9b72389f6ede25181bff542d7b65

# Terminal 2: Fulfill the escrow (as Bob)
export PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

nla escrow:fulfill \
  --escrow-uid 0xd9e1402e96c2f7a64e60bf53a45445f7254e9b72389f6ede25181bff542d7b65 \
  --fulfillment "Package delivered on Thursday" \
  --oracle 0x70997970C51812dc3A010C7d01b50e0d17dc79C8

# Save the fulfillment UID, e.g.: 0xd124b274d5fb87e3d63b38fd2f6158730b73b53166898aa692b15f5a44178809

# Watch Terminal 1 - oracle will arbitrate automatically!

# Terminal 2: Check the status
nla escrow:status \
  --escrow-uid 0xd9e1402e96c2f7a64e60bf53a45445f7254e9b72389f6ede25181bff542d7b65 \
  --deployment ./cli/deployments/localhost.json

# Terminal 2: Collect the escrow (as Bob)
nla escrow:collect \
  --escrow-uid 0xd9e1402e96c2f7a64e60bf53a45445f7254e9b72389f6ede25181bff542d7b65 \
  --fulfillment-uid 0xd124b274d5fb87e3d63b38fd2f6158730b73b53166898aa692b15f5a44178809
```

## Troubleshooting

**"Deployment file not found"**
- Run `bun run setup` first to deploy contracts

**"Account has no ETH"**
- Fund your account with test ETH from Anvil or a faucet

**"Oracle not responding"**
- Check that the oracle is running: `ps aux | grep oracle`
- Check oracle logs in Terminal 1

**"OPENAI_API_KEY not set"**
- The oracle needs OpenAI to arbitrate
- Set in `.env` file or export it

## See Also

- [Main README](../README.md) - Full documentation
- [Quick Start](../QUICKSTART.md) - 2-minute setup guide
