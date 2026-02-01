#!/usr/bin/env bun
/**
 * CLI tool to fulfill a Natural Language Agreement escrow
 * 
 * This allows users to fulfill an existing escrow by providing
 * the fulfillment text that will be arbitrated by the oracle.
 */

import { parseArgs } from "util";
import { createWalletClient, http, publicActions, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { existsSync, readFileSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { makeClient } from "alkahest-ts";
import { makeLLMClient } from "../..";
import { getChainFromNetwork, loadDeploymentWithDefaults } from "../utils.js";

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper function to display usage
function displayHelp() {
    console.log(`
Natural Language Agreement Fulfillment CLI

Fulfill an existing escrow with your completion text.

Usage:
  bun cli/fulfill-escrow.ts [options]

Options:
  --escrow-uid <uid>           Escrow UID to fulfill (required)
  --fulfillment <text>         Your fulfillment text (required)
  --oracle <address>           Oracle address that will arbitrate (required)
  --private-key <key>          Your private key (required)
  --deployment <path>          Path to deployment file (default: ./cli/deployments/devnet.json)
  --rpc-url <url>              RPC URL (default: from deployment file)
  --help, -h                   Display this help message

Environment Variables (alternative to CLI options):
  PRIVATE_KEY                  Your private key
  RPC_URL                      Custom RPC URL

Examples:
  # Fulfill an escrow
  bun cli/fulfill-escrow.ts \\
    --escrow-uid 0x... \\
    --fulfillment "The sky appears blue today" \\
    --oracle 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \\
    --private-key 0x...

  # Using environment variables
  export PRIVATE_KEY=0x...
  bun cli/fulfill-escrow.ts --escrow-uid 0x... --fulfillment "Package delivered" --oracle 0x...
`);
}

// Parse command line arguments
function parseCliArgs() {
    const { values } = parseArgs({
        args: Bun.argv.slice(2),
        options: {
            "escrow-uid": { type: "string" },
            "fulfillment": { type: "string" },
            "oracle": { type: "string" },
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
        const fulfillment = args.fulfillment;
        const oracleAddress = args.oracle;
        const privateKey = args["private-key"] || process.env.PRIVATE_KEY;
        const deploymentPath = args.deployment ;

        // Validate required parameters
        if (!escrowUid) {
            console.error("❌ Error: Escrow UID is required. Use --escrow-uid <uid>");
            console.error("Run with --help for usage information.");
            process.exit(1);
        }

        if (!fulfillment) {
            console.error("❌ Error: Fulfillment text is required. Use --fulfillment <text>");
            console.error("Run with --help for usage information.");
            process.exit(1);
        }

        if (!oracleAddress) {
            console.error("❌ Error: Oracle address is required. Use --oracle <address>");
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

        console.log("🚀 Fulfilling Natural Language Agreement Escrow\n");
        console.log("Configuration:");
        console.log(`  📦 Escrow UID: ${escrowUid}`);
        console.log(`  📝 Fulfillment: "${fulfillment}"`);
        console.log(`  ⚖️  Oracle: ${oracleAddress}`);
        console.log(`  🌐 Network: ${deployment.network}`);
        console.log(`  🌐 RPC URL: ${rpcUrl}\n`);

        // Create account and wallet
        const account = privateKeyToAccount(privateKey as `0x${string}`);
        const walletClient = createWalletClient({
            account,
            chain,
            transport: http(rpcUrl),
        }).extend(publicActions);

        console.log(`✅ Fulfiller address: ${account.address}\n`);

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

        console.log("📋 Creating fulfillment obligation...\n");

        // Create the fulfillment
        const { attested: fulfillmentAttestation } = await client.stringObligation.doObligation(
            fulfillment,
            escrowUid as `0x${string}`,
        );
        console.log("✅ Fulfillment created!\n");
        console.log("📋 Fulfillment Details:");
        console.log(`   UID: ${fulfillmentAttestation.uid}`);
        console.log(`   Attester: ${fulfillmentAttestation.attester}\n`);

        console.log("📤 Requesting arbitration from oracle...\n");
        const escrow = await client.getAttestation(escrowUid as `0x${string}`);
        const decodedEscrow = client.erc20.escrow.nonTierable.decodeObligation(escrow.data);
        // Request arbitration
        await client.arbiters.general.trustedOracle.requestArbitration(
            fulfillmentAttestation.uid,
            oracleAddress as `0x${string}`,
            decodedEscrow.demand
        );

        console.log("✨ Arbitration requested successfully!\n");
        console.log("🎯 Next Steps:");
        console.log("1. Wait for the oracle to arbitrate (usually a few seconds)");
        console.log("\n2. If approved, collect the escrow:");
        console.log(`   nla escrow:collect \\`);
        console.log(`     --escrow-uid ${escrowUid} \\`);
        console.log(`     --fulfillment-uid ${fulfillmentAttestation.uid}`);

    } catch (error) {
        console.error("❌ Failed to fulfill escrow:", error);
        process.exit(1);
    }
}

// Run the CLI
main();
