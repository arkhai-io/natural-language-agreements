#!/usr/bin/env node
import { parseArgs } from "util";
import { parseAbiParameters, createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { makeLLMClient } from "../..";
import { existsSync, readFileSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { makeClient } from "alkahest-ts";
import { fixtures } from "alkahest-ts";
import { ProviderName } from "../../nla";
import { contractAddresses } from "alkahest-ts";
import { 
    getCurrentEnvironment, 
    getDeploymentPath, 
    loadEnvFile,
    loadDeploymentWithDefaults,
    getChainFromNetwork
} from "../utils.js";

// Get the directory name for ESM modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper function to display usage
function displayHelp() {
    console.log(`
Natural Language Agreement Oracle CLI

Usage:
  bun oracle.ts [options]

Options:
  --private-key <key>          Private key of the oracle operator (optional, loaded from .env)
  --openai-api-key <key>       OpenAI API key (optional, loaded from .env)
  --anthropic-api-key <key>    Anthropic API key (optional, loaded from .env)
  --openrouter-api-key <key>   OpenRouter API key (optional, loaded from .env)
  --perplexity-api-key <key>   Perplexity API key (optional, loaded from .env)
  --env <file>                 Path to .env file (default: .env)
  --deployment <file>          Load addresses from deployment file (optional, auto-detected from current network)
  --polling-interval <ms>      Polling interval in milliseconds (default: 5000)
  --help, -h                   Display this help message

Environment Variables (from .env file or environment):
  ORACLE_PRIVATE_KEY           Private key of the oracle operator
  OPENAI_API_KEY               OpenAI API key
  ANTHROPIC_API_KEY            Anthropic API key
  OPENROUTER_API_KEY           OpenRouter API key
  PERPLEXITY_API_KEY           Perplexity API key for search tools

Examples:
  # Using .env file (default)
  bun oracle.ts

  # Using custom .env file
  bun oracle.ts --env /path/to/.env.production

  # Override with command-line parameters
  bun oracle.ts --private-key 0x... --openai-api-key sk-...

  # Using specific deployment file
  bun oracle.ts --deployment ./deployments/sepolia.json

  # Mix of .env and command-line parameters
  bun oracle.ts --openai-api-key sk-... --env .env.local

Example .env file:
  ORACLE_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
  OPENAI_API_KEY=sk-...
  ANTHROPIC_API_KEY=sk-ant-...
  OPENROUTER_API_KEY=sk-or-...
  PERPLEXITY_API_KEY=pplx-...
`);
}

// Parse command line arguments
function parseCliArgs() {
    const { values } = parseArgs({
        args: process.argv.slice(2),
        options: {
            "private-key": { type: "string" },
            "openai-api-key": { type: "string" },
            "anthropic-api-key": { type: "string" },
            "openrouter-api-key": { type: "string" },
            "perplexity-api-key": { type: "string" },
            "env": { type: "string" },
            "deployment": { type: "string" },
            "polling-interval": { type: "string" },
            "help": { type: "boolean", short: "h" },
        },
        strict: true,
    });

    return values;
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

        // Load .env file
        const envPath = args.env || ".env";
        const resolvedEnvPath = resolve(process.cwd(), envPath);
        
        if (existsSync(resolvedEnvPath)) {
            console.log(`📁 Loading environment from: ${resolvedEnvPath}\n`);
            loadEnvFile(resolvedEnvPath);
        } else if (args.env) {
            // Only error if user explicitly specified an env file
            console.error(`❌ Error: .env file not found: ${resolvedEnvPath}`);
            process.exit(1);
        }

        // Load deployment file (auto-detects current network if not specified)
        const currentEnv = getCurrentEnvironment();
        const deploymentFile = args.deployment;
        
        if (deploymentFile) {
            console.log(`� Loading deployment from: ${deploymentFile}\n`);
        } else {
            console.log(`� Auto-detected environment: ${currentEnv}\n`);
        }
        
        const deployment = loadDeploymentWithDefaults(deploymentFile);
        console.log(`✅ Loaded deployment (${deployment.network})\n`);

        const privateKey = args["private-key"] || process.env.ORACLE_PRIVATE_KEY;
        const openaiApiKey = args["openai-api-key"] || process.env.OPENAI_API_KEY;
        const anthropicApiKey = args["anthropic-api-key"] || process.env.ANTHROPIC_API_KEY;
        const openrouterApiKey = args["openrouter-api-key"] || process.env.OPENROUTER_API_KEY;
        const perplexityApiKey = args["perplexity-api-key"] || process.env.PERPLEXITY_API_KEY;
        const pollingInterval = parseInt(args["polling-interval"] || "5000");

        // Validate required parameters
        if (!deployment?.rpcUrl) {
            console.error("❌ Error: RPC URL not found in deployment file.");
            console.error("   Current environment:", getCurrentEnvironment());
            console.error("   Make sure the deployment file exists for your current network.");
            console.error("Run with --help for usage information.");
            process.exit(1);
        }

        if (!privateKey) {
            console.error("❌ Error: Private key is required.");
            console.error("   Set ORACLE_PRIVATE_KEY in .env file or use --private-key");
            console.error("Run with --help for usage information.");
            process.exit(1);
        }

        // Check if at least one API key is provided
        if (!openaiApiKey && !anthropicApiKey && !openrouterApiKey) {
            console.error("❌ Error: At least one LLM provider API key is required.");
            console.error("   Set one of these in your .env file:");
            console.error("   - OPENAI_API_KEY");
            console.error("   - ANTHROPIC_API_KEY");
            console.error("   - OPENROUTER_API_KEY");
            console.error("Run with --help for usage information.");
            process.exit(1);
        }

        console.log("🚀 Starting Natural Language Agreement Oracle...\n");
        console.log("Configuration:");
        console.log(`  📡 RPC URL: ${deployment.rpcUrl}`);
        console.log(`  🔑 Oracle Key: ${privateKey.slice(0, 6)}...${privateKey.slice(-4)}`);
        
        // Show available providers
        const availableProviders = [];
        if (openaiApiKey) availableProviders.push("OpenAI");
        if (anthropicApiKey) availableProviders.push("Anthropic");
        if (openrouterApiKey) availableProviders.push("OpenRouter");
        console.log(`  🤖 AI Providers: ${availableProviders.join(", ")}`);
        
        if (perplexityApiKey) {
            console.log(`  🔍 Perplexity Search: Enabled`);
        }
        
        if (deployment.addresses.eas) {
            console.log(`  📝 EAS Contract: ${deployment.addresses.eas}`);
        }
        console.log(`  ⏱️  Polling Interval: ${pollingInterval}ms\n`);

        // Create wallet client
        const chain = getChainFromNetwork(deployment.network);
        const account = privateKeyToAccount(privateKey as `0x${string}`);
        const walletClient = createWalletClient({
            account,
            chain,
            transport: http(deployment.rpcUrl),
        }).extend(publicActions) as any;



        // Create alkahest client
        const client = makeClient(walletClient, deployment.addresses);
        
        console.log(`✅ Oracle initialized with address: ${account.address}\n`);

        // Create LLM client
        const llmClient = client.extend(() => ({
            llm: makeLLMClient([]),
        }));

        // Add all available providers
        if (openaiApiKey) {
            llmClient.llm.addProvider({
                providerName: ProviderName.OpenAI,
                apiKey: openaiApiKey,
                perplexityApiKey: perplexityApiKey,
            });
            console.log("✅ OpenAI provider configured");
        }

        if (anthropicApiKey) {
            llmClient.llm.addProvider({
                providerName: ProviderName.Anthropic,
                apiKey: anthropicApiKey,
                perplexityApiKey: perplexityApiKey,
            });
            console.log("✅ Anthropic provider configured");
        }

        if (openrouterApiKey) {
            llmClient.llm.addProvider({
                providerName: ProviderName.OpenRouter,
                apiKey: openrouterApiKey,
                perplexityApiKey: perplexityApiKey,
            });
            console.log("✅ OpenRouter provider configured");
        }

        console.log("\n🎯 LLM Arbitrator configured and ready\n");
        console.log("👂 Listening for arbitration requests...\n");

        // Define the obligation ABI
        const obligationAbi = parseAbiParameters("(string item)");

        // Start listening and arbitrating
        const { unwatch } = await client.arbiters.general.trustedOracle.arbitrateMany(
            async ({ attestation, demand }) => {
                console.log(`\n📨 New arbitration request received!`);
                console.log(`   Attestation UID: ${attestation.uid}`);
                
                try {
                    // Extract obligation data
                    const obligation = client.extractObligationData(
                        obligationAbi,
                        attestation,
                    );
                    const obligationItem = obligation[0].item;
                    console.log(`   Obligation: "${obligationItem}"`);

                    const trustedOracleDemandData = client.arbiters.general.trustedOracle.decodeDemand(demand);
                    console.log(`   DEBUG - trustedOracleDemandData:`, trustedOracleDemandData);
                    
                    const nlaDemandData = llmClient.llm.decodeDemand(trustedOracleDemandData.data);
                    console.log(`   DEBUG - nlaDemandData:`, nlaDemandData);
                    
                    console.log(`   Demand: "${nlaDemandData.demand}"`);
                    console.log(`   Provider: ${nlaDemandData.arbitrationProvider}`);
                    console.log(`   Model: ${nlaDemandData.arbitrationModel}`);

                    // Validate the demand data before proceeding
                    if (!nlaDemandData.demand || !nlaDemandData.arbitrationModel || nlaDemandData.arbitrationModel.includes('\u0000')) {
                        console.error(`   ❌ Invalid demand data - contains null bytes or empty fields`);
                        console.error(`   This usually means the demand was encoded incorrectly`);
                        console.error(`   Skipping this attestation (throwing error to avoid on-chain recording)...\n`);
                        throw new Error('Invalid demand data - skipping attestation');
                    }

                    // Perform arbitration using LLM
                    console.log(`   🤔 Arbitrating with ${nlaDemandData.arbitrationProvider}...`);
                    const result = await llmClient.llm.arbitrate(
                        nlaDemandData,
                        obligationItem
                    );

                    console.log(`   ✨ Arbitration result: ${result ? "✅ APPROVED" : "❌ REJECTED"}`);
                    return result;
                } catch (error) {
                    console.error(`   ❌ Error during arbitration:`, error);
                    console.error(`   Continuing to listen for new requests...\n`);
                    return false; // Return false instead of throwing to keep oracle running
                }
            },
            {
                onAfterArbitrate: async (decision: any) => {
                    try {
                        console.log(`   📝 Arbitration decision recorded on-chain`);
                        console.log(`   Decision UID: ${decision.attestation.uid}`);
                        console.log(`   Result: ${decision.decision ? "✅ Fulfilled" : "❌ Not Fulfilled"}\n`);
                    } catch (error: any) {
                        console.error(`   ⚠️  Failed to record arbitration on-chain:`, error.message);
                        console.error(`   This may be due to transaction conflicts or gas issues`);
                        console.error(`   Continuing to listen for new requests...\n`);
                    }
                },
                pollingInterval,
            },
        );

        console.log("✨ Oracle is now running. Press Ctrl+C to stop.\n");

        // Show next steps for creating escrow
        if (deployment) {
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            console.log("📝 Next Steps - Create Your First Escrow:\n");
            
            if (currentEnv === 'devnet') {
                console.log("1. Export your private key (use a test account):");
                console.log("   export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80\n");
            } else {
                console.log("1. Export your private key:");
                console.log("   export PRIVATE_KEY=<your-private-key>\n");
            }
            
            console.log("2. Create an escrow:");
            console.log("   nla escrow:create \\");
            console.log("     --demand \"The sky is blue\" \\");
            console.log("     --amount 10 \\");
            
            if (currentEnv === 'devnet' && deployment.addresses.mockERC20A) {
                console.log(`     --token ${deployment.addresses.mockERC20A} \\`);
            } else {
                console.log("     --token <ERC20_TOKEN_ADDRESS> \\");
            }
            
            console.log(`     --oracle ${account.address} \\`);
            console.log("     --arbitration-provider \"OpenAI\" \\");
            console.log("     --arbitration-model \"gpt-4o-mini\"");
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
        }

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
