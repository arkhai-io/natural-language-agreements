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
import { fixtures, contracts } from "alkahest-ts";

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
  --output <path>              Output file for deployment addresses (default: ./cli/deployments/<network>.json)
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
        
        const EAS = fixtures.EAS;
        const SchemaRegistry = fixtures.SchemaRegistry;
        const MockERC20Permit = fixtures.MockERC20Permit;
        const TrustedOracleArbiter = contracts.TrustedOracleArbiter;
        const StringObligation = contracts.StringObligation;
        const ERC20EscrowObligation = contracts.ERC20EscrowObligation;
        const ERC20PaymentObligation = contracts.ERC20PaymentObligation;
        const ERC20BarterCrossToken = contracts.ERC20BarterCrossToken;

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

        // Deploy barter utils (required for permitAndBuyWithErc20)
        console.log("🔄 Deploying barter utils...\n");

        addresses.erc20BarterUtils = await deployContract(
            "ERC20 Barter Utils",
            ERC20BarterCrossToken.abi,
            ERC20BarterCrossToken.bytecode.object,
            [
                addresses.eas,
                addresses.erc20EscrowObligation,
                addresses.erc20PaymentObligation,
                "0x0000000000000000000000000000000000000000", // erc721Escrow (not used)
                "0x0000000000000000000000000000000000000000", // erc721Payment (not used)
                "0x0000000000000000000000000000000000000000", // erc1155Escrow (not used)
                "0x0000000000000000000000000000000000000000", // erc1155Payment (not used)
                "0x0000000000000000000000000000000000000000", // tokenBundleEscrow (not used)
                "0x0000000000000000000000000000000000000000", // tokenBundlePayment (not used)
            ]
        );

        // Deploy mock ERC20 tokens for testing
        console.log("🪙  Deploying mock ERC20 tokens...\n");

        addresses.mockERC20A = await deployContract(
            "Mock ERC20 Token A",
            MockERC20Permit.abi,
            MockERC20Permit.bytecode.object,
            ["Test Token A", "TSTA"]
        );

        addresses.mockERC20B = await deployContract(
            "Mock ERC20 Token B",
            MockERC20Permit.abi,
            MockERC20Permit.bytecode.object,
            ["Test Token B", "TSTB"]
        );

        addresses.mockERC20C = await deployContract(
            "Mock ERC20 Token C",
            MockERC20Permit.abi,
            MockERC20Permit.bytecode.object,
            ["Test Token C", "TSTC"]
        );

        // Distribute tokens to known Anvil accounts for testing
        if (network === "localhost") {
            console.log("💸 Distributing tokens to test accounts...\n");
            
            // Get Anvil test accounts dynamically
            const testAccounts = await client.request({
                method: "eth_accounts",
            }) as `0x${string}`[];
            
            // Use first 3 accounts
            const recipients = testAccounts.slice(0, 3);

            for (const testAccount of recipients) {
                // Skip if it's the deployer account
                if (testAccount.toLowerCase() === account.address.toLowerCase()) {
                    continue;
                }
                
                // Transfer 10000 tokens to each account
                for (const [tokenName, tokenAddress] of [
                    ["Token A", addresses.mockERC20A],
                    ["Token B", addresses.mockERC20B],
                    ["Token C", addresses.mockERC20C],
                ]) {
                    const hash = await client.writeContract({
                        address: tokenAddress as `0x${string}`,
                        abi: MockERC20Permit.abi,
                        functionName: "transfer",
                        args: [testAccount, parseEther("10000")],
                    });
                    await client.waitForTransactionReceipt({ hash });
                }
                console.log(`   ✅ Distributed tokens to ${testAccount}`);
            }
            
            console.log("\n✅ Tokens distributed to test accounts\n");
        }

        // Save deployment addresses
        // Get the script directory and go up to project root, then into cli/deployments
        const scriptDir = import.meta.dir;
        const projectRoot = resolve(scriptDir, "../..");
        const outputPath = args.output || resolve(projectRoot, `cli/deployments/${network}.json`);
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

        if (network === "localhost") {
            console.log("\n🪙  Mock ERC20 Tokens:");
            console.log(`   Token A (TSTA): ${addresses.mockERC20A}`);
            console.log(`   Token B (TSTB): ${addresses.mockERC20B}`);
            console.log(`   Token C (TSTC): ${addresses.mockERC20C}`);
            console.log("\n💰 Each test account has 10000 of each token");
        }

        console.log("\n🎯 Next steps:");
        console.log("1. Start the oracle:");
        console.log(`   nla start-oracle`);
        console.log("\n2. Export your private key (use a test account private key):");
        console.log(`   export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`);
        console.log("\n3. Create an escrow:");
        console.log(`   nla escrow:create \\`);
        console.log(`     --demand "The sky is blue" \\`);
        console.log(`     --amount 10 \\`);
        console.log(`     --token ${addresses.mockERC20A} \\`);
        console.log(`     --oracle 0x70997970C51812dc3A010C7d01b50e0d17dc79C8`);

    } catch (error) {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    }
}

// Run the deployment
main();
