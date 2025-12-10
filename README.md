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

## Quick Start

### Option 1: Automated Setup (Easiest - 1 command!)

Set your OpenAI API key and run everything:

```bash
export OPENAI_API_KEY=sk-your-key-here
./scripts/dev.sh
```

This will:
- ✅ Check all prerequisites
- ✅ Start Anvil (local blockchain)
- ✅ Deploy all contracts
- ✅ Start the oracle
- ✅ Ready to test!

To stop everything:
```bash
./scripts/stop.sh
```

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
./scripts/deploy.sh localhost
```

This creates `deployments/localhost.json` with all contract addresses.

#### 3. Start Oracle

```bash
# Terminal 2 (or 3): Start oracle
./scripts/start-oracle.sh localhost
```

#### 4. Test It

```bash
# Terminal 3 (or 4): Run tests
bun test tests/nlaOracle.test.ts
```

Watch the oracle terminal - you'll see it process arbitration requests in real-time!

## Deployment to Other Networks

### Sepolia Testnet

```bash
# 1. Get Sepolia ETH from faucet
# 2. Set your keys
export DEPLOYER_PRIVATE_KEY=0x...
export ORACLE_PRIVATE_KEY=0x...
export OPENAI_API_KEY=sk-...

# 3. Deploy
./scripts/deploy.sh sepolia https://sepolia.infura.io/v3/YOUR-KEY

# 4. Start oracle
./scripts/start-oracle.sh sepolia
```

### Mainnet

```bash
# ⚠️ PRODUCTION - Be careful!
export DEPLOYER_PRIVATE_KEY=0x...
export ORACLE_PRIVATE_KEY=0x...
export OPENAI_API_KEY=sk-...

# Deploy
./scripts/deploy.sh mainnet https://mainnet.infura.io/v3/YOUR-KEY

# Start oracle (consider running as a service)
./scripts/start-oracle.sh mainnet
```

## Available Scripts

```bash
./scripts/dev.sh              # Complete local setup (all-in-one)
./scripts/deploy.sh [network] # Deploy contracts to network
./scripts/start-oracle.sh [network]  # Start oracle for network
./scripts/stop.sh             # Stop all services
```

## Production Deployment

For production, run the oracle as a background service:

### Using systemd (Linux)

```bash
# Copy service file
sudo cp deployment/nla-oracle.service /etc/systemd/system/

# Edit the service file with your paths and config
sudo nano /etc/systemd/system/nla-oracle.service

# Enable and start
sudo systemctl enable nla-oracle
sudo systemctl start nla-oracle

# View logs
sudo journalctl -u nla-oracle -f
```

### Using nohup (Simple)

```bash
# Start in background
nohup ./scripts/start-oracle.sh mainnet > oracle.log 2>&1 &

# Save PID
echo $! > oracle.pid

# Stop later
kill $(cat oracle.pid)
```

### Using screen (Simple)

```bash
# Start screen session
screen -S oracle

# Run oracle
./scripts/start-oracle.sh mainnet

# Detach: Ctrl+A, then D
# Reattach: screen -r oracle
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
├── oracle.ts           # Oracle CLI application
├── deploy.ts           # Contract deployment script
├── index.ts            # Development entry point
├── clients/
│   └── nla.ts         # Natural Language Agreement client
├── tests/
│   ├── nla.test.ts           # Basic tests
│   └── nlaOracle.test.ts     # Oracle arbitration tests
├── deployments/        # Deployment addresses (generated)
│   ├── localhost.json
│   ├── sepolia.json
│   └── mainnet.json
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
