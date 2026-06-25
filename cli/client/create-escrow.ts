#!/usr/bin/env bun
/**
 * CLI tool to create a Natural Language Agreement escrow
 * 
 * This allows users to create an escrow with a natural language demand
 * that will be arbitrated by the oracle.
 */

import { parseArgs } from "util";
import { createWalletClient, publicActions, parseEther, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { existsSync, readFileSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { makeClient } from "alkahest-ts";
import { makeLLMClient } from "../..";
import {fixtures} from "alkahest-ts";
import { getCurrentEnvironment, getChainFromNetwork, loadDeploymentWithDefaults, getPrivateKey, getRpcTransport } from "../utils.js";

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper function to display usage
function displayHelp() {
    const currentEnv = getCurrentEnvironment();
    console.log(`
Natural Language Agreement Escrow CLI

Create an escrow with a natural language demand that will be arbitrated by an oracle.

Current environment: ${currentEnv}

Usage:
  bun cli/create-escrow.ts [options]

Options:
  --demand <text>              Natural language demand (required)
  --amount <number>            Amount of tokens to escrow (required)
  --token <address>            ERC20 token address (required)
  --oracle <address>           Oracle address that will arbitrate (required)
  --private-key <key>          Your private key (required)
  --deployment <path>          Path to deployment file (default: current environment)
  --rpc-url <url>              RPC URL (default: from deployment file)
  --arbitration-provider <name> Arbitration provider (default: OpenAI)
  --arbitration-model <model>  Arbitration model (default: gpt-4o-mini)
  --arbitration-prompt <text>  Custom arbitration prompt (optional)
  --help, -h                   Display this help message

Environment Variables (alternative to CLI options):
  PRIVATE_KEY                  Your private key
  RPC_URL                      Custom RPC URL

Examples:
  # Create an escrow for a simple demand
  bun cli/create-escrow.ts \\
    --demand "The sky is blue" \\
    --amount 10 \\
    --token 0x5FbDB2315678afecb367f032d93F642f64180aa3 \\
    --oracle 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \\
    --private-key 0x...

  # Using environment variables
  export PRIVATE_KEY=0x...
  bun cli/create-escrow.ts --demand "Deliver package by Friday" --amount 100 --token 0x... --oracle 0x...
`);
}

// Parse command line arguments
function parseCliArgs() {
    const { values } = parseArgs({
        args: Bun.argv.slice(2),
        options: {
            "demand": { type: "string" },
            "amount": { type: "string" },
            "token": { type: "string" },
            "oracle": { type: "string" },
            "private-key": { type: "string" },
            "deployment": { type: "string" },
            "rpc-url": { type: "string" },
            "arbitration-provider": { type: "string" },
            "arbitration-model": { type: "string" },
            "arbitration-prompt": { type: "string" },
            "help": { type: "boolean", short: "h" },
        },
        strict: true,
    });

    return values;
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
        const demand = args.demand;
        const amount = args.amount;
        const tokenAddress = args.token;
        const oracleAddress = args.oracle;
        const privateKey = args["private-key"] || getPrivateKey();
        const deploymentPath = args.deployment;
        
        // Arbitration configuration with defaults
        const arbitrationProvider = args["arbitration-provider"] || "OpenAI";
        const arbitrationModel = args["arbitration-model"] || "gpt-4o-mini";
        const arbitrationPrompt = args["arbitration-prompt"] || 
            `Evaluate the fulfillment against the demand and decide whether the demand was validly fulfilled

Demand: {{demand}}

Fulfillment: {{obligation}}`;

        // Validate required parameters
        if (!demand) {
            console.error("❌ Error: Demand is required. Use --demand <text>");
            console.error("Run with --help for usage information.");
            process.exit(1);
        }

        if (!amount) {
            console.error("❌ Error: Amount is required. Use --amount <number>");
            console.error("Run with --help for usage information.");
            process.exit(1);
        }

        if (!tokenAddress) {
            console.error("❌ Error: Token address is required. Use --token <address>");
            console.error("Run with --help for usage information.");
            process.exit(1);
        }

        if (!oracleAddress) {
            console.error("❌ Error: Oracle address is required. Use --oracle <address>");
            console.error("Run with --help for usage information.");
            process.exit(1);
        }

        if (!privateKey) {
            console.error("❌ Error: Private key is required");
            console.error("\n💡 You can either:");
            console.error("   1. Set it globally: nla wallet:set --private-key <your-key>");
            console.error("   2. Use for this command only: --private-key <your-key>");
            console.error("   3. Set PRIVATE_KEY environment variable");
            console.error("\nRun with --help for usage information.");
            process.exit(1);
        }

        // Load deployment file (auto-detects current network if not specified)
        let deployment;
        try {
            deployment = loadDeploymentWithDefaults(deploymentPath);
        } catch (error) {
            console.error(`❌ Error: ${(error as Error).message}`);
            console.error("Please deploy contracts first or specify correct path with --deployment");
            process.exit(1);
        }

        const rpcUrl = args["rpc-url"] || deployment.rpcUrl;
        const chain = getChainFromNetwork(deployment.network);

        console.log("🚀 Creating Natural Language Agreement Escrow\n");
        console.log("Configuration:");
        console.log(`  📝 Demand: "${demand}"`);
        console.log(`  💰 Amount: ${amount} tokens`);
        console.log(`  🪙 Token: ${tokenAddress}`);
        console.log(`  ⚖️  Oracle: ${oracleAddress}`);
        console.log(`  🌐 Network: ${deployment.network}`);
        console.log(`  🌐 RPC URL: ${rpcUrl}\n`);

        // Create account and wallet
        const account = privateKeyToAccount(privateKey as `0x${string}`);
        const walletClient = createWalletClient({
            account,
            chain,
            transport: getRpcTransport(rpcUrl),
        }).extend(publicActions);

        console.log(`✅ User address: ${account.address}\n`);

        // Check balance
        const balance = await walletClient.getBalance({ address: account.address });
        console.log(`💰 ETH balance: ${parseFloat(formatEther(balance)).toFixed(4)} ETH\n`);

        if (balance === 0n) {
            console.error("❌ Error: Account has no ETH for gas. Please fund the account first.");
            process.exit(1);
        }

        // Create alkahest client
        const client = makeClient(
            walletClient as any,
            deployment.addresses
        );

        // Extend with LLM client (only for encoding the demand, no API calls needed)
        const llmClient = client.extend((c) => ({
            llm: makeLLMClient([]),
        }));

        // Check token balance
        const tokenBalance = await walletClient.readContract({
            address: tokenAddress as `0x${string}`,
            abi: fixtures.MockERC20Permit.abi,
            functionName: "balanceOf",
            args: [account.address],
        }) as bigint;

        console.log(`💰 Token balance: ${tokenBalance.toString()} tokens\n`);

        if (tokenBalance < BigInt(amount)) {
            console.error(`❌ Error: Insufficient token balance. You have ${tokenBalance.toString()} but need ${amount}`);
            process.exit(1);
        }

        console.log("📋 Creating escrow\n");

        // Encode the demand with oracle arbiter
        const arbiter = deployment.addresses.trustedOracleArbiter as `0x${string}`;
        const encodedDemand = client.arbiters.general.trustedOracle.encodeDemand({
            oracle: oracleAddress as `0x${string}`,
            data: llmClient.llm.encodeDemand({
                arbitrationProvider,
                arbitrationModel,
                arbitrationPrompt,
                demand: demand
            })
        }) as `0x${string}`;

        // Create the escrow
        const { attested: escrow } = await client.erc20.escrow.default.permitAndCreate(
            {
                address: tokenAddress as `0x${string}`,
                value: BigInt(amount),
            },
            { arbiter, demand: encodedDemand },
            0n,
        );

        console.log("✨ Escrow created successfully!\n");
        console.log("📋 Escrow Details:");
        console.log(`   UID: ${escrow.uid}`);
        console.log(`   Attester: ${escrow.attester}`);
        console.log(`   Recipient: ${escrow.recipient}`);

        console.log("🎯 Next Steps:");
        console.log("1. Someone fulfills the obligation:");
        console.log(`   nla escrow:fulfill \\`);
        console.log(`     --escrow-uid ${escrow.uid} \\`);
        console.log(`     --fulfillment "Yes, the sky is blue" \\`);
        console.log(`     --oracle ${oracleAddress}`);
        console.log("\n2. The oracle will arbitrate the fulfillment automatically");
        console.log("\n3. If approved, collect the escrow:");
        console.log(`   nla escrow:collect \\`);
        console.log(`     --escrow-uid ${escrow.uid} \\`);
        console.log(`     --fulfillment-uid <fulfillment-uid>`);

    } catch (error) {
        console.error("❌ Failed to create escrow:", error);
        process.exit(1);
    }
}

// Run the CLI
main();
