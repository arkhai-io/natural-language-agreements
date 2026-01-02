#!/usr/bin/env bun
/**
 * CLI tool to create a Natural Language Agreement escrow
 * 
 * This allows users to create an escrow with a natural language demand
 * that will be arbitrated by the oracle.
 */

import { parseArgs } from "util";
import { createWalletClient, http, publicActions, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { makeClient } from "alkahest-ts";
import { makeLLMClient } from "../..";
import {fixtures} from "alkahest-ts";

// Helper function to display usage
function displayHelp() {
    console.log(`
Natural Language Agreement Escrow CLI

Create an escrow with a natural language demand that will be arbitrated by an oracle.

Usage:
  bun cli/create-escrow.ts [options]

Options:
  --demand <text>              Natural language demand (required)
  --amount <number>            Amount of tokens to escrow (required)
  --token <address>            ERC20 token address (required)
  --oracle <address>           Oracle address that will arbitrate (required)
  --private-key <key>          Your private key (required)
  --deployment <path>          Path to deployment file (default: ./cli/deployments/localhost.json)
  --rpc-url <url>              RPC URL (default: from deployment file)
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
        const privateKey = args["private-key"] || process.env.PRIVATE_KEY;
        const deploymentPath = args.deployment || "./cli/deployments/localhost.json";

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
            console.error("❌ Error: Private key is required. Use --private-key or set PRIVATE_KEY");
            console.error("Run with --help for usage information.");
            process.exit(1);
        }

        // Load deployment file
        if (!existsSync(resolve(deploymentPath))) {
            console.error(`❌ Error: Deployment file not found: ${deploymentPath}`);
            console.error("Please deploy contracts first or specify correct path with --deployment");
            process.exit(1);
        }

        const deployment = JSON.parse(readFileSync(resolve(deploymentPath), "utf-8"));
        const rpcUrl = args["rpc-url"] || deployment.rpcUrl;

        console.log("🚀 Creating Natural Language Agreement Escrow\n");
        console.log("Configuration:");
        console.log(`  📝 Demand: "${demand}"`);
        console.log(`  💰 Amount: ${amount} tokens`);
        console.log(`  🪙 Token: ${tokenAddress}`);
        console.log(`  ⚖️  Oracle: ${oracleAddress}`);
        console.log(`  🌐 RPC URL: ${rpcUrl}\n`);

        // Create account and wallet
        const account = privateKeyToAccount(privateKey as `0x${string}`);
        const walletClient = createWalletClient({
            account,
            chain: foundry,
            transport: http(rpcUrl),
        }).extend(publicActions);

        console.log(`✅ User address: ${account.address}\n`);

        // Check balance
        const balance = await walletClient.getBalance({ address: account.address });
        console.log(`💰 ETH balance: ${parseFloat((balance / 10n ** 18n).toString()).toFixed(4)} ETH\n`);

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
        const arbiter = deployment.addresses.trustedOracleArbiter;
        const encodedDemand = client.arbiters.general.trustedOracle.encode({
            oracle: oracleAddress as `0x${string}`,
            data: llmClient.llm.encodeDemand({
                arbitrationProvider: "OpenAI",
                arbitrationModel: "gpt-4.1",
                arbitrationPrompt: `Evaluate the fulfillment against the demand and decide whether the demand was validly fulfilled

Demand: {{demand}}

Fulfillment: {{obligation}}`,
                demand: demand
            })
        });

        // Create the escrow
        const { attested: escrow } = await client.erc20.permitAndBuyWithErc20(
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
