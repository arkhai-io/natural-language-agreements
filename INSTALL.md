# Installing NLA CLI Globally

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn or pnpm
- A blockchain node (local Anvil or remote RPC URL)
- At least one LLM provider API key (OpenAI, Anthropic, or OpenRouter)

## Installation

### Global Installation (Recommended)

Install the NLA CLI globally to use it from anywhere:

```bash
npm install -g nla
```

Or with yarn:
```bash
yarn global add nla
```

Or with pnpm:
```bash
pnpm add -g nla
```

### Verify Installation

```bash
nla --help
```

## Configuration

Create a `.env` file in your project directory:

```bash
# Copy the example environment file
cp node_modules/nla/.env.example .env

# Edit with your configuration
nano .env
```

Required environment variables:
```bash
# At least one LLM provider API key
OPENAI_API_KEY=sk-...
# OR
ANTHROPIC_API_KEY=sk-ant-...
# OR
OPENROUTER_API_KEY=sk-or-...

# Oracle configuration
ORACLE_PRIVATE_KEY=0x...
RPC_URL=http://localhost:8545

# Optional: For enhanced search
PERPLEXITY_API_KEY=pplx-...
```

## Quick Start

### 1. Start Development Environment

```bash
nla dev
```

This will:
- Start Anvil (local blockchain)
- Deploy all contracts
- Start the oracle

### 2. Create an Escrow

```bash
nla escrow:create \
  --demand "The sky is blue" \
  --amount 10 \
  --token 0xa513E6E4b8f2a923D98304ec87F64353C4D5C853 \
  --oracle 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
```

### 3. Fulfill an Escrow

```bash
nla escrow:fulfill \
  --escrow-uid 0x... \
  --fulfillment "The sky appears blue today" \
  --oracle 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
```

### 4. Collect Payment

```bash
nla escrow:collect \
  --escrow-uid 0x... \
  --fulfillment-uid 0x...
```

## Uninstallation

```bash
npm uninstall -g nla
```

## Development

If you want to contribute or modify the CLI:

```bash
# Clone the repository
git clone https://github.com/arkhai-io/natural-language-agreements.git
cd natural-language-agreements

# Install dependencies
npm install

# Build
npm run build

# Link locally
npm link
```

## Troubleshooting

### Command not found after installation

Make sure your npm global bin directory is in your PATH:

```bash
# Check npm global bin path
npm bin -g

# Add to PATH (add to ~/.bashrc or ~/.zshrc)
export PATH="$(npm bin -g):$PATH"
```

### Permission errors on Linux/Mac

If you get permission errors, either:

1. Use a Node version manager (recommended):
```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install and use Node
nvm install 18
nvm use 18

# Now install without sudo
npm install -g nla
```

2. Or configure npm to use a different directory:
```bash
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

## Support

For issues and questions:
- GitHub: https://github.com/arkhai-io/natural-language-agreements/issues
- Documentation: https://github.com/arkhai-io/natural-language-agreements
