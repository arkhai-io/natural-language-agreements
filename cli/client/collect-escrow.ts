#!/usr/bin/env bun
/**
 * CLI tool to collect a fulfilled Natural Language Agreement escrow
 * 
 * After the oracle approves the fulfillment, use this to collect the escrowed tokens.
 */

import { parseArgs } from "util";
import { createWalletClient, http, publicActions, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { existsSync, readFileSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { makeClient } from "alkahest-ts";
import { getChainFromNetwork, loadDeploymentWithDefaults } from "../utils.js";

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper function to display usage
function displayHelp() {
    console.log(`
Natural Language Agreement Collection CLI

Collect escrowed tokens after oracle approves fulfillment.

Usage:
  bun cli/collect-escrow.ts [options]

Options:
  --escrow-uid <uid>           Escrow UID to collect (required)
  --fulfillment-uid <uid>      Fulfillment UID that was approved (required)
  --private-key <key>          Your private key (required)
  --deployment <path>          Path to deployment file (default: ./cli/deployments/devnet.json)
  --rpc-url <url>              RPC URL (default: from deployment file)
  --help, -h                   Display this help message

Environment Variables (alternative to CLI options):
  PRIVATE_KEY                  Your private key
  RPC_URL                      Custom RPC URL

Examples:
  # Collect approved escrow
  bun cli/collect-escrow.ts \\
    --escrow-uid 0x... \\
    --fulfillment-uid 0x... \\
    --private-key 0x...

  # Using environment variables
  export PRIVATE_KEY=0x...
  bun cli/collect-escrow.ts --escrow-uid 0x... --fulfillment-uid 0x...
`);
}

// Parse command line arguments
function parseCliArgs() {
    const { values } = parseArgs({
        args: Bun.argv.slice(2),
        options: {
            "escrow-uid": { type: "string" },
            "fulfillment-uid": { type: "string" },
            "private-key": { type: "string" },
            "deployment": { type: "string" },
            "rpc-url": { type: "string" },
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
        const escrowUid = args["escrow-uid"];
        const fulfillmentUid = args["fulfillment-uid"];
        const privateKey = args["private-key"] || process.env.PRIVATE_KEY;
        const deploymentPath = args.deployment;

        // Validate required parameters
        if (!escrowUid) {
            console.error("❌ Error: Escrow UID is required. Use --escrow-uid <uid>");
            console.error("Run with --help for usage information.");
            process.exit(1);
        }

        if (!fulfillmentUid) {
            console.error("❌ Error: Fulfillment UID is required. Use --fulfillment-uid <uid>");
            console.error("Run with --help for usage information.");
            process.exit(1);
        }

        if (!privateKey) {
            console.error("❌ Error: Private key is required. Use --private-key or set PRIVATE_KEY");
            console.error("Run with --help for usage information.");
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

        console.log("🚀 Collecting Natural Language Agreement Escrow\n");
        console.log("Configuration:");
        console.log(`  📦 Escrow UID: ${escrowUid}`);
        console.log(`  ✅ Fulfillment UID: ${fulfillmentUid}`);
        console.log(`  🌐 RPC URL: ${rpcUrl}\n`);

        // Create account and wallet
        const account = privateKeyToAccount(privateKey as `0x${string}`);
        const walletClient = createWalletClient({
            account,
            chain,
            transport: http(rpcUrl),
        }).extend(publicActions);

        console.log(`✅ Collector address: ${account.address}\n`);

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

        console.log("💰 Collecting escrow...\n");

        // Collect the escrow
        const collectionHash = await client.erc20.escrow.nonTierable.collect(
            escrowUid as `0x${string}`,
            fulfillmentUid as `0x${string}`,
        );

        console.log("✨ Escrow collected successfully!\n");
        console.log("📋 Transaction Details:");
        console.log(`   Transaction Hash: ${collectionHash}`);
        console.log(`   Block Explorer: ${rpcUrl.includes('localhost') ? 'Local Anvil' : 'View on explorer'}\n`);

        console.log("🎉 Success! The escrowed tokens have been transferred to you.");

    } catch (error) {
        console.error("❌ Failed to collect escrow:", error);
        process.exit(1);
    }
}

// Run the CLI
main();
