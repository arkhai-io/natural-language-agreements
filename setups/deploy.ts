#!/usr/bin/env bun
/**
 * Deployment script for Alkahest Natural Language Agreement Oracle
 * 
 * This script deploys all necessary contracts to a blockchain network
 * and saves the deployment addresses for use by the oracle CLI.
 */

import { parseArgs } from "util";
import { createWalletClient, http, publicActions, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, sepolia, foundry } from "viem/chains";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";

// Helper function to display usage
function displayHelp() {
    console.log(`
Alkahest Contract Deployment CLI

Usage:
  bun deploy.ts [options]

Options:
  --network <name>             Network to deploy to: mainnet, sepolia, localhost (required)
  --rpc-url <url>              Custom RPC URL (overrides network default)
  --private-key <key>          Deployer's private key (required)
  --output <path>              Output file for deployment addresses (default: ./deployments/<network>.json)
  --help, -h                   Display this help message

Environment Variables (alternative to CLI options):
  DEPLOYER_PRIVATE_KEY         Deployer's private key
  RPC_URL                      Custom RPC URL

Networks:
  mainnet                      Ethereum Mainnet
  sepolia                      Ethereum Sepolia Testnet
  localhost                    Local development (Anvil/Hardhat)

Examples:
  # Deploy to local Anvil
  bun deploy.ts --network localhost --private-key 0x...

  # Deploy to Sepolia
  bun deploy.ts --network sepolia --private-key 0x... --rpc-url https://sepolia.infura.io/v3/YOUR-KEY

  # Using environment variables
  export DEPLOYER_PRIVATE_KEY=0x...
  bun deploy.ts --network localhost
`);
}

// Parse command line arguments
function parseCliArgs() {
    const { values } = parseArgs({
        args: Bun.argv.slice(2),
        options: {
            "network": { type: "string" },
            "rpc-url": { type: "string" },
            "private-key": { type: "string" },
            "output": { type: "string" },
            "help": { type: "boolean", short: "h" },
        },
        strict: true,
    });

    return values;
}

// Get chain configuration
function getChain(network: string) {
    switch (network.toLowerCase()) {
        case "mainnet":
            return mainnet;
        case "sepolia":
            return sepolia;
        case "localhost":
        case "local":
            return foundry;
        default:
            throw new Error(`Unknown network: ${network}. Use mainnet, sepolia, or localhost`);
    }
}

async function main() {
    try {
        const args = parseCliArgs();

        // Display help if requested
        if (args.help) {
            displayHelp();
            process.exit(0);
        }

        // Get configuration
        const network = args.network;
        const privateKey = args["private-key"] || process.env.DEPLOYER_PRIVATE_KEY;
        let rpcUrl = args["rpc-url"] || process.env.RPC_URL;

        // Validate required parameters
        if (!network) {
            console.error("❌ Error: Network is required. Use --network <name>");
            console.error("Run with --help for usage information.");
            process.exit(1);
        }

        if (!privateKey) {
            console.error("❌ Error: Private key is required. Use --private-key or set DEPLOYER_PRIVATE_KEY");
            console.error("Run with --help for usage information.");
            process.exit(1);
        }

        // Get chain config
        const chain = getChain(network);
        
        // Set default RPC URL if not provided
        if (!rpcUrl) {
            if (network === "localhost") {
                rpcUrl = "http://localhost:8545";
            } else {
                console.error("❌ Error: RPC URL is required for non-localhost networks. Use --rpc-url");
                process.exit(1);
            }
        }

        console.log("🚀 Starting Alkahest Contract Deployment\n");
        console.log("Configuration:");
        console.log(`  🌐 Network: ${network}`);
        console.log(`  📡 RPC URL: ${rpcUrl}`);
        console.log(`  🔑 Deployer: ${privateKey.slice(0, 6)}...${privateKey.slice(-4)}\n`);

        // Create deployer account and client
        const account = privateKeyToAccount(privateKey as `0x${string}`);
        const client = createWalletClient({
            account,
            chain,
            transport: http(rpcUrl),
        }).extend(publicActions);

        console.log(`✅ Deployer address: ${account.address}\n`);

        // Check balance
        const balance = await client.getBalance({ address: account.address });
        console.log(`💰 Deployer balance: ${parseFloat((balance / 10n ** 18n).toString()).toFixed(4)} ETH\n`);

        if (balance === 0n) {
            console.error("❌ Error: Deployer has no ETH. Please fund the account first.");
            process.exit(1);
        }

        // Import contract artifacts from alkahest
        console.log("📦 Loading contract artifacts...\n");
        
        // This requires alkahest to be properly set up
        const alkahestPath = "../../alkahest/sdks/ts";
        const contractsPath = `${alkahestPath}/src/contracts`;
        
        // Import necessary artifacts
        const EAS = await import(`${alkahestPath}/tests/fixtures/EAS.json`);
        const SchemaRegistry = await import(`${alkahestPath}/tests/fixtures/SchemaRegistry.json`);
        const TrustedOracleArbiter = await import(`${contractsPath}/TrustedOracleArbiter.json`);
        const StringObligation = await import(`${contractsPath}/StringObligation.json`);
        const ERC20EscrowObligation = await import(`${contractsPath}/ERC20EscrowObligation.json`);
        const ERC20PaymentObligation = await import(`${contractsPath}/ERC20PaymentObligation.json`);

        console.log("✅ Contract artifacts loaded\n");

        // Deployment addresses
        const addresses: Record<string, string> = {};

        // Helper to deploy contracts
        async function deployContract(
            name: string,
            abi: any,
            bytecode: string,
            args: any[] = []
        ): Promise<string> {
            console.log(`📝 Deploying ${name}...`);
            
            const hash = await client.deployContract({
                abi,
                bytecode: bytecode as `0x${string}`,
                args,
            });

            console.log(`   Transaction: ${hash}`);
            const receipt = await client.waitForTransactionReceipt({ hash });
            
            if (!receipt.contractAddress) {
                throw new Error(`Failed to deploy ${name}`);
            }

            console.log(`   ✅ Deployed at: ${receipt.contractAddress}\n`);
            return receipt.contractAddress;
        }

        // Deploy core contracts
        console.log("🏗️  Deploying core contracts...\n");

        addresses.easSchemaRegistry = await deployContract(
            "EAS Schema Registry",
            SchemaRegistry.abi,
            SchemaRegistry.bytecode.object
        );

        addresses.eas = await deployContract(
            "EAS",
            EAS.abi,
            EAS.bytecode.object,
            [addresses.easSchemaRegistry]
        );

        // Deploy arbiters
        console.log("⚖️  Deploying arbiters...\n");

        addresses.trustedOracleArbiter = await deployContract(
            "Trusted Oracle Arbiter",
            TrustedOracleArbiter.abi,
            TrustedOracleArbiter.bytecode.object,
            [addresses.eas]
        );

        // Deploy obligations
        console.log("📋 Deploying obligations...\n");

        addresses.stringObligation = await deployContract(
            "String Obligation",
            StringObligation.abi,
            StringObligation.bytecode.object,
            [addresses.eas, addresses.easSchemaRegistry]
        );

        addresses.erc20EscrowObligation = await deployContract(
            "ERC20 Escrow Obligation",
            ERC20EscrowObligation.abi,
            ERC20EscrowObligation.bytecode.object,
            [addresses.eas, addresses.easSchemaRegistry]
        );

        addresses.erc20PaymentObligation = await deployContract(
            "ERC20 Payment Obligation",
            ERC20PaymentObligation.abi,
            ERC20PaymentObligation.bytecode.object,
            [addresses.eas, addresses.easSchemaRegistry]
        );

        // Save deployment addresses
        const outputPath = args.output || resolve(`./deployments/${network}.json`);
        const outputDir = resolve(outputPath, "..");
        
        if (!existsSync(outputDir)) {
            mkdirSync(outputDir, { recursive: true });
        }

        const deployment = {
            network,
            chainId: chain.id,
            rpcUrl,
            deployedAt: new Date().toISOString(),
            deployer: account.address,
            addresses,
        };

        writeFileSync(outputPath, JSON.stringify(deployment, null, 2));

        console.log("✨ Deployment complete!\n");
        console.log("📄 Deployment details saved to:", outputPath);
        console.log("\n📋 Deployed Addresses:");
        Object.entries(addresses).forEach(([name, address]) => {
            console.log(`   ${name}: ${address}`);
        });

        console.log("\n🎯 Next steps:");
        console.log("1. Save the deployment file for your records");
        console.log("2. Update your oracle configuration with the EAS contract address:");
        console.log(`   export EAS_CONTRACT_ADDRESS=${addresses.eas}`);
        console.log("3. Start the oracle:");
        console.log(`   bun run oracle -- --rpc-url ${rpcUrl} --eas-contract ${addresses.eas}`);

    } catch (error) {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    }
}

// Run the deployment
main();
