#!/usr/bin/env node
/**
 * CLI tool to manually arbitrate NLA escrow fulfillments
 *
 * This allows an oracle operator to manually review and submit
 * arbitration decisions for escrow fulfillments, as an alternative
 * to the automated oracle listener.
 */

import { parseArgs } from "util";
import { createWalletClient, createPublicClient, http, publicActions, fromHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { makeClient } from "alkahest-ts";
import { contracts } from "alkahest-ts";
import { makeLLMClient } from "../..";
import { ProviderName } from "../../nla";
import {
    getCurrentEnvironment,
    getChainFromNetwork,
    loadDeploymentWithDefaults,
    getPrivateKey,
    loadEnvFile,
} from "../utils.js";
import { existsSync } from "fs";
import { resolve } from "path";
import { createInterface } from "readline";

// Helper function to display usage
function displayHelp() {
    console.log(`
Natural Language Agreement - Arbitrate Escrow Fulfillments

Manually review and submit arbitration decisions for escrow fulfillments.
Your wallet address must match the oracle specified in the escrow.

Usage:
  nla escrow:arbitrate [options]

Options:
  --escrow-uid <uid|all>       Escrow UID to arbitrate, or "all" to scan for pending requests (required)
  --private-key <key>          Oracle operator's private key
  --deployment <file>          Load addresses from deployment file (optional)
  --rpc-url <url>              RPC URL (optional, from deployment file)
  --auto                       Auto-arbitrate using LLM (skip interactive confirmation)
  --openai-api-key <key>       OpenAI API key (for auto mode)
  --anthropic-api-key <key>    Anthropic API key (for auto mode)
  --openrouter-api-key <key>   OpenRouter API key (for auto mode)
  --perplexity-api-key <key>   Perplexity API key (for auto mode)
  --env <file>                 Path to .env file (default: .env)
  --help, -h                   Display this help message

Examples:
  # Arbitrate a specific escrow (interactive)
  nla escrow:arbitrate --escrow-uid 0x...

  # Scan for all pending arbitration requests
  nla escrow:arbitrate --escrow-uid all

  # Auto-arbitrate using LLM (non-interactive)
  nla escrow:arbitrate --escrow-uid 0x... --auto
`);
}

// Parse command line arguments
function parseCliArgs() {
    const { values } = parseArgs({
        args: process.argv.slice(2),
        options: {
            "escrow-uid": { type: "string" },
            "private-key": { type: "string" },
            "deployment": { type: "string" },
            "rpc-url": { type: "string" },
            "auto": { type: "boolean" },
            "openai-api-key": { type: "string" },
            "anthropic-api-key": { type: "string" },
            "openrouter-api-key": { type: "string" },
            "perplexity-api-key": { type: "string" },
            "env": { type: "string" },
            "help": { type: "boolean", short: "h" },
        },
        strict: true,
    });

    return values;
}

function prompt(question: string): Promise<string> {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

type PendingArbitration = {
    escrowUid: `0x${string}`;
    fulfillmentUid: `0x${string}`;
    arbitrationRequestUid: `0x${string}`;
    demand: `0x${string}`;
    demandText: string;
    fulfillmentText: string;
    nlaDemand: {
        arbitrationProvider: string;
        arbitrationModel: string;
        arbitrationPrompt: string;
        demand: string;
    };
};

async function main() {
    try {
        const args = parseCliArgs();

        if (args.help) {
            displayHelp();
            process.exit(0);
        }

        // Load .env file
        const envPath = args.env || ".env";
        const resolvedEnvPath = resolve(process.cwd(), envPath);
        if (existsSync(resolvedEnvPath)) {
            loadEnvFile(resolvedEnvPath);
        }

        const escrowUidArg = args["escrow-uid"];
        const privateKey = args["private-key"] || getPrivateKey();
        const deploymentFile = args["deployment"];
        const autoMode = args["auto"] || false;

        if (!escrowUidArg) {
            console.error("❌ Error: --escrow-uid is required (use a UID or \"all\")");
            console.error("Run with --help for usage information.");
            process.exit(1);
        }

        if (!privateKey) {
            console.error("❌ Error: Private key is required");
            console.error("\n💡 You can either:");
            console.error("   1. Set it globally: nla wallet:set --private-key <your-key>");
            console.error("   2. Use for this command only: --private-key <your-key>");
            console.error("   3. Set PRIVATE_KEY environment variable");
            process.exit(1);
        }

        // Load deployment
        const deployment = loadDeploymentWithDefaults(deploymentFile);
        const rpcUrl = args["rpc-url"] || deployment.rpcUrl;
        const chain = getChainFromNetwork(deployment.network);
        const addresses = deployment.addresses;

        // Create clients
        const account = privateKeyToAccount(privateKey as `0x${string}`);
        const walletClient = createWalletClient({
            account,
            chain,
            transport: http(rpcUrl),
        }).extend(publicActions) as any;

        const publicClient = createPublicClient({
            chain,
            transport: http(rpcUrl),
        });

        const client = makeClient(walletClient, addresses);
        const llmClient = makeLLMClient([]);

        console.log(`⚖️  NLA Manual Arbitration\n`);
        console.log(`   Oracle address: ${account.address}`);
        console.log(`   Network: ${deployment.network}`);
        console.log(`   RPC URL: ${rpcUrl}\n`);

        // Set up LLM providers for auto mode
        if (autoMode) {
            const openaiApiKey = args["openai-api-key"] || process.env.OPENAI_API_KEY;
            const anthropicApiKey = args["anthropic-api-key"] || process.env.ANTHROPIC_API_KEY;
            const openrouterApiKey = args["openrouter-api-key"] || process.env.OPENROUTER_API_KEY;
            const perplexityApiKey = args["perplexity-api-key"] || process.env.PERPLEXITY_API_KEY;

            if (!openaiApiKey && !anthropicApiKey && !openrouterApiKey) {
                console.error("❌ Error: Auto mode requires at least one LLM provider API key.");
                console.error("   Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or OPENROUTER_API_KEY");
                process.exit(1);
            }

            if (openaiApiKey) {
                llmClient.addProvider({ providerName: ProviderName.OpenAI, apiKey: openaiApiKey, perplexityApiKey });
            }
            if (anthropicApiKey) {
                llmClient.addProvider({ providerName: ProviderName.Anthropic, apiKey: anthropicApiKey, perplexityApiKey });
            }
            if (openrouterApiKey) {
                llmClient.addProvider({ providerName: ProviderName.OpenRouter, apiKey: openrouterApiKey, perplexityApiKey });
            }
        }

        // Find pending arbitration requests
        const pending: PendingArbitration[] = [];

        console.log("🔍 Scanning for arbitration requests...\n");

        // Get all Attested events from EAS
        const filter = await publicClient.createContractEventFilter({
            address: addresses.eas as `0x${string}`,
            abi: contracts.IEAS.abi.abi,
            eventName: "Attested",
            fromBlock: 0n,
        });
        const events = await publicClient.getFilterLogs({ filter });

        // Determine which escrows to check
        const scanAll = escrowUidArg.toLowerCase() === "all";
        const targetEscrowUid = scanAll ? null : escrowUidArg as `0x${string}`;

        // Build a map of all attestation UIDs for quick lookup
        const attestationUids = new Set(events.map((e: any) => e.args?.uid?.toLowerCase()));

        // Find fulfillments (attestations that reference an escrow)
        for (const event of events) {
            const fulfillmentUid = (event as any).args?.uid as `0x${string}`;
            const refUid = (event as any).args?.refUID as `0x${string}`;
            if (!fulfillmentUid || !refUid) continue;

            // Skip if we're targeting a specific escrow and this doesn't match
            if (!scanAll && refUid.toLowerCase() !== targetEscrowUid!.toLowerCase()) continue;

            // Check if refUid points to a valid escrow
            // A fulfillment references an escrow, and an arbitration decision references a fulfillment
            // We need to check if this is a fulfillment (not an arbitration decision)
            let escrowAttestation: any;
            try {
                escrowAttestation = await publicClient.readContract({
                    address: addresses.eas as `0x${string}`,
                    abi: contracts.IEAS.abi.abi,
                    functionName: "getAttestation",
                    args: [refUid],
                });
            } catch {
                continue;
            }

            // Try to decode as an escrow obligation to verify it's actually an escrow
            let escrowData: any;
            try {
                escrowData = client.erc20.escrow.nonTierable.decodeObligation(escrowAttestation.data);
            } catch {
                continue; // Not an escrow
            }

            // Decode the demand to check if our address is the oracle
            let trustedOracleDemand: any;
            let nlaDemand: any;
            try {
                trustedOracleDemand = client.arbiters.general.trustedOracle.decodeDemand(escrowData.demand);
                nlaDemand = llmClient.decodeDemand(trustedOracleDemand.data);
            } catch {
                continue; // Not an NLA demand or not using trusted oracle arbiter
            }

            // Check if we are the oracle for this escrow
            if (trustedOracleDemand.oracle.toLowerCase() !== account.address.toLowerCase()) {
                continue;
            }

            // Check if this fulfillment already has an arbitration decision
            const hasDecision = events.some((e) => {
                const eRefUid = (e as any).args?.refUID;
                return eRefUid && eRefUid.toLowerCase() === fulfillmentUid.toLowerCase();
            });

            if (hasDecision) continue;

            // Decode the fulfillment text
            let fulfillmentText: string;
            try {
                const fulfillmentAttestation = await publicClient.readContract({
                    address: addresses.eas as `0x${string}`,
                    abi: contracts.IEAS.abi.abi,
                    functionName: "getAttestation",
                    args: [fulfillmentUid],
                });
                const commitRevealData = client.commitReveal.decode((fulfillmentAttestation as any).data);
                fulfillmentText = fromHex(commitRevealData.payload, "string");
            } catch {
                continue; // Can't decode fulfillment
            }

            pending.push({
                escrowUid: refUid,
                fulfillmentUid,
                arbitrationRequestUid: fulfillmentUid,
                demand: escrowData.demand,
                demandText: nlaDemand.demand,
                fulfillmentText,
                nlaDemand,
            });
        }

        if (pending.length === 0) {
            if (scanAll) {
                console.log("✅ No pending arbitration requests found for your oracle address.\n");
            } else {
                console.log(`✅ No pending arbitration requests found for escrow ${escrowUidArg}.\n`);
                console.log("   This could mean:");
                console.log("   - No fulfillments have been submitted yet");
                console.log("   - All fulfillments have already been arbitrated");
                console.log("   - Your address is not the oracle for this escrow");
            }
            process.exit(0);
        }

        console.log(`📋 Found ${pending.length} pending arbitration request(s):\n`);

        // Process each pending arbitration
        for (const item of pending) {
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            console.log(`📦 Escrow:      ${item.escrowUid}`);
            console.log(`📨 Fulfillment: ${item.fulfillmentUid}`);
            console.log(`📝 Demand:      "${item.demandText}"`);
            console.log(`💬 Fulfillment: "${item.fulfillmentText}"`);
            console.log(`🤖 Provider:    ${item.nlaDemand.arbitrationProvider} / ${item.nlaDemand.arbitrationModel}`);
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

            let decision: boolean;

            if (autoMode) {
                // Use LLM to arbitrate
                console.log(`🤔 Arbitrating with ${item.nlaDemand.arbitrationProvider}...`);
                decision = await llmClient.arbitrate(item.nlaDemand, item.fulfillmentText);
                console.log(`   LLM decision: ${decision ? "✅ APPROVE" : "❌ REJECT"}\n`);
            } else {
                // Interactive mode - ask the user
                const answer = await prompt("   Enter decision (approve/reject): ");
                const normalized = answer.toLowerCase();
                if (normalized === "approve" || normalized === "a" || normalized === "yes" || normalized === "y" || normalized === "true") {
                    decision = true;
                } else if (normalized === "reject" || normalized === "r" || normalized === "no" || normalized === "n" || normalized === "false") {
                    decision = false;
                } else if (normalized === "skip" || normalized === "s") {
                    console.log("   Skipped.\n");
                    continue;
                } else {
                    console.log("   Unrecognized input, skipping.\n");
                    continue;
                }
            }

            // Submit the decision on-chain
            console.log(`📤 Submitting ${decision ? "APPROVE" : "REJECT"} decision on-chain...`);
            try {
                const { unwatch } = await client.arbiters.general.trustedOracle.arbitrateMany(
                    async () => decision,
                    {
                        onAfterArbitrate: async (result: any) => {
                            console.log(`   ✅ Decision recorded!`);
                            console.log(`   Decision UID: ${result.attestation.uid}`);
                            console.log(`   Result: ${result.decision ? "APPROVED" : "REJECTED"}\n`);
                        },
                        pollingInterval: 1000,
                    }
                );

                // Wait briefly for the arbitration to be picked up and processed
                await new Promise(resolve => setTimeout(resolve, 3000));
                unwatch();
            } catch (error: any) {
                console.error(`   ❌ Failed to submit decision: ${error.message}\n`);
            }
        }

        console.log("✨ Arbitration complete!\n");

    } catch (error) {
        console.error("❌ Fatal error:", error);
        process.exit(1);
    }
}

main();
