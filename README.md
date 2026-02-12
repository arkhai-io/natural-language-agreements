# natural-language-agreements

Natural Language Agreement Oracle - Create and manage blockchain escrows using natural language demands powered by AI.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [CLI Commands](#cli-commands)
- [LLM Providers](#llm-providers)
- [Deployment](#deployment-to-other-networks)
- [Examples](#examples)

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18.0.0 (or [Bun](https://bun.sh))
- [Foundry](https://book.getfoundry.sh/getting-started/installation) - Ethereum development toolkit (includes Anvil)
- API key for at least one LLM provider (OpenAI, Anthropic, or OpenRouter)

## Installation

### Option 1: Install from npm (Recommended)

Install the `nla` CLI globally:

```bash
npm install -g nla
```

Verify installation:

```bash
nla help
```

### Option 2: Install from source

```bash
# Clone the repository
git clone https://github.com/arkhai-io/natural-language-agreements.git
cd natural-language-agreements

# Install dependencies
bun install  # or: npm install

# Link the CLI globally
bun link     # or: npm link

# Verify installation
nla help
```

## Quick Start

### 1. Configure API Keys

Create a `.env` file or export environment variables:

```bash
# Required: At least one LLM provider
export OPENAI_API_KEY=sk-your-openai-key
# or
export ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
# or
export OPENROUTER_API_KEY=sk-or-your-openrouter-key

# Optional: Private key for deploying/signing transactions
export PRIVATE_KEY=0x...
```

### 2. Start Development Environment

Run the all-in-one setup command:

```bash
nla dev
```

This automatically:
- ✅ Starts Anvil (local blockchain)
- ✅ Deploys all contracts
- ✅ Creates mock ERC20 tokens
- ✅ Starts the oracle listener
- ✅ Displays contract addresses

### 3. Create Your First Escrow

```bash
nla escrow:create \
  --demand "The sky is blue" \
  --amount 10 \
  --token 0xa513e6e4b8f2a923d98304ec87f64353c4d5c853 \
  --oracle 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

### 4. Stop Services

```bash
nla stop
```

## CLI Commands

### Core Commands

| Command | Description |
|---------|-------------|
| `nla dev` | Start complete local development environment |
| `nla deploy [network] [rpc]` | Deploy contracts to a network |
| `nla start-oracle [options]` | Start the oracle service |
| `nla stop` | Stop all running services |
| `nla help` | Display help information |

### Wallet Management

| Command | Description |
|---------|-------------|
| `nla wallet:set --private-key <key>` | Save private key to config |
| `nla wallet:show` | Show current wallet address |
| `nla wallet:clear` | Remove private key from config |

### Escrow Operations

| Command | Description |
|---------|-------------|
| `nla escrow:create [options]` | Create a new escrow |
| `nla escrow:fulfill [options]` | Submit fulfillment for an escrow |
| `nla escrow:collect [options]` | Collect approved escrow funds |
| `nla escrow:status --escrow-uid <uid>` | Check escrow status |

### Environment Management

| Command | Description |
|---------|-------------|
| `nla switch <env>` | Switch between environments |
| `nla network` | Show current environment |

Available environments: `anvil`, `sepolia`, `base-sepolia`, `mainnet`

### Global Options

Most commands support these options:

| Option | Description |
|--------|-------------|
| `--private-key <key>` | Private key for signing transactions |
| `--rpc-url <url>` | Custom RPC endpoint URL |
| `--deployment <file>` | Path to deployment JSON file |
| `--env <file>` | Path to .env file |
| `--help, -h` | Show command help |

### Oracle-Specific Options

When starting the oracle:

```bash
nla start-oracle [options]
```

| Option | Description |
|--------|-------------|
| `--rpc-url <url>` | RPC URL (overrides deployment file) |
| `--private-key <key>` | Oracle operator private key |
| `--deployment <file>` | Deployment file path |
| `--polling-interval <ms>` | Polling interval (default: 5000ms) |
| `--openai-api-key <key>` | OpenAI API key |
| `--anthropic-api-key <key>` | Anthropic API key |
| `--openrouter-api-key <key>` | OpenRouter API key |
| `--perplexity-api-key <key>` | Perplexity API key |

**Example with custom RPC:**

```bash
nla start-oracle --rpc-url https://eth-mainnet.g.alchemy.com/v2/YOUR-KEY
```

### Escrow Creation Options

```bash
nla escrow:create \
  --demand <text> \
  --amount <number> \
  --token <address> \
  --oracle <address> \
  [--arbitration-provider <provider>] \
  [--arbitration-model <model>] \
  [--arbitration-prompt <prompt>] \
  [--private-key <key>]
```

| Option | Required | Description |
|--------|----------|-------------|
| `--demand` | Yes | Natural language demand |
| `--amount` | Yes | Token amount to escrow |
| `--token` | Yes | ERC20 token contract address |
| `--oracle` | Yes | Oracle address |
| `--arbitration-provider` | No | AI provider (default: OpenAI) |
| `--arbitration-model` | No | Model name (default: gpt-4o-mini) |
| `--arbitration-prompt` | No | Custom prompt template |
| `--private-key` | No | Signer private key |

### NPM Scripts

If installed from source, you can use npm/bun scripts:

```bash
bun run setup              # Same as: nla dev
bun run deploy             # Same as: nla deploy
bun run oracle             # Same as: nla start-oracle
bun run stop               # Same as: nla stop
bun run escrow:create      # Same as: nla escrow:create
bun run escrow:fulfill     # Same as: nla escrow:fulfill
bun run escrow:collect     # Same as: nla escrow:collect
```

## LLM Providers

### Supported LLM Providers

The oracle supports multiple AI providers for arbitration:

1. **OpenAI** (default)
   - Models: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-3.5-turbo`
   - API Key: Get from [OpenAI Platform](https://platform.openai.com/api-keys)
   - Environment Variable: `OPENAI_API_KEY`

2. **Anthropic (Claude)**
   - Models: `claude-3-5-sonnet-20241022`, `claude-3-opus-20240229`, `claude-3-sonnet-20240229`
   - API Key: Get from [Anthropic Console](https://console.anthropic.com/)
   - Environment Variable: `ANTHROPIC_API_KEY`

3. **OpenRouter**
   - Models: Any model available on OpenRouter (e.g., `openai/gpt-4`, `anthropic/claude-3-opus`)
   - API Key: Get from [OpenRouter](https://openrouter.ai/keys)
   - Environment Variable: `OPENROUTER_API_KEY`

4. **Perplexity** (for enhanced search)
   - Optional: Enhances LLM responses with real-time search
   - API Key: Get from [Perplexity](https://www.perplexity.ai/settings/api)
   - Environment Variable: `PERPLEXITY_API_KEY`

## Examples

### Basic Escrow Workflow

```bash
# 1. Start development environment
nla dev

# 2. Create an escrow
nla escrow:create \
  --demand "The sky is blue" \
  --amount 10 \
  --token 0xa513e6e4b8f2a923d98304ec87f64353c4d5c853 \
  --oracle 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

# 3. Fulfill the escrow
nla escrow:fulfill \
  --escrow-uid 0x... \
  --fulfillment "The sky appears blue today" \
  --oracle 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

# 4. Check status
nla escrow:status --escrow-uid 0x...

# 5. Collect funds (if approved)
nla escrow:collect \
  --escrow-uid 0x... \
  --fulfillment-uid 0x...
```

### Using Different AI Providers

```bash
# Create escrow with Anthropic Claude
nla escrow:create \
  --demand "Deliver package by Friday" \
  --amount 100 \
  --token 0xa513e6e4b8f2a923d98304ec87f64353c4d5c853 \
  --oracle 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \
  --arbitration-provider "Anthropic" \
  --arbitration-model "claude-3-5-sonnet-20241022"

# Create escrow with OpenRouter
nla escrow:create \
  --demand "Write a 1000-word article" \
  --amount 50 \
  --token 0xa513e6e4b8f2a923d98304ec87f64353c4d5c853 \
  --oracle 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \
  --arbitration-provider "OpenRouter" \
  --arbitration-model "anthropic/claude-3-opus"
```

### Custom RPC and Deployment

```bash
# Deploy to custom network
nla deploy \
  --network sepolia \
  --rpc-url https://sepolia.infura.io/v3/YOUR-KEY \
  --private-key 0x...

# Start oracle with custom RPC
nla start-oracle \
  --rpc-url https://eth-mainnet.g.alchemy.com/v2/YOUR-KEY \
  --private-key 0x...

# Use specific deployment file
nla start-oracle --deployment ./my-deployment.json
```

### Wallet Management

```bash
# Save private key globally
nla wallet:set --private-key 0x...

# Check current wallet
nla wallet:show

# Clear saved key
nla wallet:clear
```

## Deployment to Other Networks

### Sepolia Testnet

```bash
# 1. Get Sepolia ETH from faucet
# 2. Set your keys
export PRIVATE_KEY=0x...
export OPENAI_API_KEY=sk-...

# 3. Deploy
nla deploy sepolia https://sepolia.infura.io/v3/YOUR-KEY

# 4. Start oracle
nla start-oracle sepolia
```

### Mainnet

```bash
# ⚠️ PRODUCTION - Be careful!
export PRIVATE_KEY=0x...
export OPENAI_API_KEY=sk-...

# Deploy contracts
nla deploy mainnet https://mainnet.infura.io/v3/YOUR-KEY

# Start oracle (consider running as a service)
nla start-oracle --rpc-url https://mainnet.infura.io/v3/YOUR-KEY
```

## Environment Configuration

The CLI uses environment files and a config directory for storing settings:

### Environment Variables

Create a `.env` file in your project root:

```bash
# Private Keys
PRIVATE_KEY=0x...                    # For signing transactions

# RPC URLs
RPC_URL=http://localhost:8545        # Default RPC endpoint

# LLM Provider API Keys (at least one required)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-...
PERPLEXITY_API_KEY=pplx-...          # Optional for search
```

### Config Directory

The CLI stores configuration in `~/.nla/`:

- `~/.nla/config.json` - Saved wallet private key (via `nla wallet:set`)
- `~/.nla/environment` - Current active environment

## Advanced Usage

### Using Custom Deployment Files

Create a custom deployment file:

```json
{
  "network": "custom",
  "chainId": 1,
  "rpcUrl": "https://your-rpc.example.com",
  "addresses": {
    "eas": "0x...",
    "trustedOracleArbiter": "0x...",
    "erc20EscrowObligation": "0x..."
  }
}
```

Use it with commands:

```bash
nla start-oracle --deployment ./my-deployment.json
nla escrow:create --deployment ./my-deployment.json ...
```

### Running Oracle as a Service

For production deployments, run the oracle as a systemd service:

```ini
[Unit]
Description=NLA Oracle Service
After=network.target

[Service]
Type=simple
User=nla
WorkingDirectory=/home/nla
ExecStart=/usr/bin/nla start-oracle --rpc-url https://mainnet.infura.io/v3/YOUR-KEY
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Multiple Environments

Switch between different networks:

```bash
# Switch to sepolia
nla switch sepolia

# Check current environment
nla network

# Switch to mainnet
nla switch mainnet

# Back to local development
nla switch anvil
```

## Troubleshooting

### Common Issues

**"Private key is required" error:**
```bash
# Option 1: Set globally
nla wallet:set --private-key 0x...

# Option 2: Export environment variable
export PRIVATE_KEY=0x...

# Option 3: Pass with command
nla deploy --private-key 0x...
```

**"RPC URL not found" error:**
```bash
# Option 1: Pass RPC URL
nla start-oracle --rpc-url https://...

# Option 2: Set in environment
export RPC_URL=https://...

# Option 3: Use deployment file with rpcUrl
nla start-oracle --deployment ./deployment.json
```

**"No LLM provider API key" error:**
```bash
# Set at least one provider key
export OPENAI_API_KEY=sk-...
# or
export ANTHROPIC_API_KEY=sk-ant-...
```

## Documentation

For more detailed documentation:

- [CLI Documentation](cli/README.md) - Complete CLI reference
- [API Documentation](https://github.com/arkhai-io/natural-language-agreements) - GitHub repository
- [Alkahest SDK](https://github.com/arkhai-io/alkahest-ts) - Underlying SDK

## Project Structure

```
natural-language-agreements/
├── cli/                          # CLI tools and server components
│   ├── index.ts                  # Main CLI entry point (nla command)
│   ├── README.md                 # CLI documentation
│   ├── client/                   # User-facing escrow tools
│   │   ├── create-escrow.ts      # Create escrow CLI with arbitration config
│   │   ├── fulfill-escrow.ts     # Fulfill escrow CLI
│   │   └── collect-escrow.ts     # Collect escrow CLI
│   ├── server/                   # Server-side components
│   │   ├── deploy.ts             # Contract deployment script
│   │   └── oracle.ts             # Multi-provider oracle service
│   ├── commands/                 # CLI command implementations
│   │   ├── dev.ts                # Development environment setup
│   │   ├── stop.ts               # Stop services
│   │   ├── switch.ts             # Switch environments
│   │   └── wallet.ts             # Wallet management
│   └── deployments/              # Deployment addresses (generated)
│       ├── anvil.json
│       ├── sepolia.json
│       ├── base-sepolia.json
│       └── mainnet.json
├── nla.ts                        # Natural Language Agreement client library
├── tests/                        # Test files
│   ├── nla.test.ts
│   └── nlaOracle.test.ts
├── index.ts                      # Main exports
└── package.json                  # Package configuration
```

## Security Notes

⚠️ **Important Security Considerations:**

- Never commit real private keys to version control
- Use environment variables or secure secret management for production
- The `.env` file is gitignored by default
- Example keys in `.env.example` are from Anvil - NEVER use in production
- Keep API keys secure (OpenAI, Anthropic, OpenRouter)
- For production deployments:
  * Use hardware wallets or secure key management services
  * Implement rate limiting on the oracle
  * Monitor arbitration decisions for anomalies
  * Consider multi-signature setups for critical operations

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions:
- GitHub Issues: https://github.com/arkhai-io/natural-language-agreements/issues
- Documentation: [CLI README](cli/README.md)