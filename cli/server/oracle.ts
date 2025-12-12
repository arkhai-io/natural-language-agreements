#!/usr/bin/env bun
import { parseArgs } from "util";
import { parseAbiParameters } from "viem";
import { makeLLMClient } from "../../clients/nla";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

// Helper function to display usage
function displayHelp() {
    console.log(`
Natural Language Agreement Oracle CLI

Usage:
  bun oracle.ts [options]

Options:
  --rpc-url <url>              RPC URL for the blockchain network (required)
  --private-key <key>          Private key of the oracle operator (required)
  --openai-api-key <key>       OpenAI API key (required)
  --eas-contract <address>     EAS contract address (optional)
  --deployment <file>          Load addresses from deployment file (optional)
  --polling-interval <ms>      Polling interval in milliseconds (default: 5000)
  --help, -h                   Display this help message

Environment Variables (alternative to CLI options):
  RPC_URL                      RPC URL for the blockchain network
  ORACLE_PRIVATE_KEY           Private key of the oracle operator
  OPENAI_API_KEY               OpenAI API key
  EAS_CONTRACT_ADDRESS         EAS contract address

Examples:
  # Using command line options
  bun oracle.ts --rpc-url http://localhost:8545 --private-key 0x... --openai-api-key sk-...

  # Using deployment file
  bun oracle.ts --deployment ./deployments/localhost.json --private-key 0x... --openai-api-key sk-...

  # Using environment variables
  export OPENAI_API_KEY=sk-...
  export RPC_URL=http://localhost:8545
  export ORACLE_PRIVATE_KEY=0x...
  bun oracle.ts
`);
}

// Parse command line arguments
function parseCliArgs() {
    const { values } = parseArgs({
        args: Bun.argv.slice(2),
        options: {
            "rpc-url": { type: "string" },
            "private-key": { type: "string" },
            "openai-api-key": { type: "string" },
            "eas-contract": { type: "string" },
            "deployment": { type: "string" },
            "polling-interval": { type: "string" },
            "help": { type: "boolean", short: "h" },
        },
        strict: true,
    });

    return values;
}

// Load deployment file
function loadDeployment(filePath: string) {
    if (!existsSync(filePath)) {
        throw new Error(`Deployment file not found: ${filePath}`);
    }

    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content);
}

// Main function
async function main() {
    try {
        const args = parseCliArgs();

        // Display help if requested
        if (args.help) {
            displayHelp();
            process.exit(0);
        }

        let rpcUrl = args["rpc-url"] || process.env.RPC_URL;
        let easContract = args["eas-contract"] || process.env.EAS_CONTRACT_ADDRESS;
        let deploymentAddresses = null;

        // Load deployment file if provided
        if (args.deployment) {
            console.log(`📄 Loading deployment from: ${args.deployment}\n`);
            const deployment = loadDeployment(args.deployment);
            deploymentAddresses = deployment.addresses;
            
            if (!rpcUrl) {
                rpcUrl = deployment.rpcUrl;
            }
            if (!easContract) {
                easContract = deployment.addresses.eas;
            }
            
            console.log(`✅ Loaded deployment (${deployment.network})\n`);
        }

        const privateKey = args["private-key"] || process.env.ORACLE_PRIVATE_KEY;
        const openaiApiKey = args["openai-api-key"] || process.env.OPENAI_API_KEY;
        const pollingInterval = parseInt(args["polling-interval"] || "5000");

        // Validate required parameters
        if (!rpcUrl) {
            console.error("❌ Error: RPC URL is required. Use --rpc-url or set RPC_URL environment variable.");
            console.error("Run with --help for usage information.");
            process.exit(1);
        }

        if (!privateKey) {
            console.error("❌ Error: Private key is required. Use --private-key or set ORACLE_PRIVATE_KEY environment variable.");
            console.error("Run with --help for usage information.");
            process.exit(1);
        }

        if (!openaiApiKey) {
            console.error("❌ Error: OpenAI API key is required. Use --openai-api-key or set OPENAI_API_KEY environment variable.");
            console.error("Run with --help for usage information.");
            process.exit(1);
        }

        // Import alkahest client
        const { makeClient } = await import("../../../alkahest/sdks/ts/src/index.ts");
        const { createWalletClient, http, publicActions } = await import("viem");
        const { privateKeyToAccount } = await import("viem/accounts");
        const { foundry } = await import("viem/chains");

        console.log("🚀 Starting Natural Language Agreement Oracle...\n");
        console.log("Configuration:");
        console.log(`  📡 RPC URL: ${rpcUrl}`);
        console.log(`  🔑 Oracle Key: ${privateKey.slice(0, 6)}...${privateKey.slice(-4)}`);
        console.log(`  🤖 AI Provider: OpenAI`);
        if (easContract) {
            console.log(`  📝 EAS Contract: ${easContract}`);
        }
        console.log(`  ⏱️  Polling Interval: ${pollingInterval}ms\n`);

        // Create wallet client
        const account = privateKeyToAccount(privateKey as `0x${string}`);
        const walletClient = createWalletClient({
            account,
            chain: foundry,
            transport: http(rpcUrl),
        }).extend(publicActions) as any;

        // Create alkahest client
        const client = makeClient(walletClient, deploymentAddresses || { eas: easContract });
        
        console.log(`✅ Oracle initialized with address: ${account.address}\n`);

        // Create LLM client
        const llmClient = client.extend(() => ({
            llm: makeLLMClient([]),
        }));

        llmClient.llm.addProvider({
            providerName: "OpenAI",
            apiKey: openaiApiKey,
        });

        console.log("🎯 LLM Arbitrator configured and ready\n");
        console.log("👂 Listening for arbitration requests...\n");

        // Define the obligation ABI
        const obligationAbi = parseAbiParameters("(string item)");

        // Start listening and arbitrating
        const { unwatch } = await client.oracle.listenAndArbitrate(
            async (attestation: any) => {
                console.log(`\n📨 New arbitration request received!`);
                console.log(`   Attestation UID: ${attestation.uid}`);
                
                try {
                    // Extract obligation data
                    const obligation = client.extractObligationData(
                        obligationAbi,
                        attestation,
                    );
                    console.log(`   Obligation: "${obligation[0].item}"`);

                    // Get demand data
                    const [, demand] = await client.getEscrowAndDemand(
                        llmClient.llm.LLMAbi,
                        attestation,
                    );
                    console.log(`   Demand: "${demand[0].demand}"`);
                    console.log(`   Model: ${demand[0].arbitrationModel}`);

                    // Perform arbitration using LLM
                    console.log(`   🤔 Arbitrating with AI...`);
                    const result = await llmClient.llm.arbitrate(
                        demand[0],
                        obligation[0].item
                    );

                    console.log(`   ✨ Arbitration result: ${result ? "✅ APPROVED" : "❌ REJECTED"}`);
                    return result;
                } catch (error) {
                    console.error(`   ❌ Error during arbitration:`, error);
                    throw error;
                }
            },
            {
                onAfterArbitrate: async (decision: any) => {
                    console.log(`   📝 Arbitration decision recorded on-chain`);
                    console.log(`   Decision UID: ${decision.attestation.uid}`);
                    console.log(`   Result: ${decision.decision ? "✅ Fulfilled" : "❌ Not Fulfilled"}\n`);
                },
                pollingInterval,
            },
        );

        console.log("✨ Oracle is now running. Press Ctrl+C to stop.\n");

        // Handle graceful shutdown
        const shutdown = async () => {
            console.log("\n\n🛑 Shutting down oracle...");
            unwatch();
            console.log("👋 Oracle stopped gracefully");
            process.exit(0);
        };

        process.on("SIGINT", shutdown);
        process.on("SIGTERM", shutdown);

        // Keep the process alive
        await new Promise(() => { });

    } catch (error) {
        console.error("❌ Fatal error:", error);
        process.exit(1);
    }
}

// Run the CLI
main();
