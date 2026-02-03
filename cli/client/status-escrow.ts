#!/usr/bin/env node
import { parseArgs } from "util";
import { createPublicClient, http, parseAbiParameters, decodeAbiParameters } from "viem";
import { contracts } from "alkahest-ts";
import { getChainFromNetwork, loadDeploymentWithDefaults } from "../utils.js";

// Helper function to display usage
function displayHelp() {
    console.log(`
Natural Language Agreement - Check Escrow Status

Usage:
  bun status-escrow.ts [options]

Options:
  --escrow-uid <uid>           Escrow UID to check (required)
  --deployment <file>          Load addresses from deployment file (optional)
  --help, -h                   Display this help message

Environment Variables:
  RPC_URL                      RPC URL for blockchain connection

Examples:
  # Check escrow status
  bun status-escrow.ts --escrow-uid 0x...

  # Use specific deployment file
  bun status-escrow.ts --escrow-uid 0x... --deployment ./deployments/sepolia.json
`);
}

// Parse command line arguments
function parseCliArgs() {
    const { values } = parseArgs({
        args: process.argv.slice(2),
        options: {
            "escrow-uid": { type: "string" },
            "deployment": { type: "string" },
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

        const escrowUid = args["escrow-uid"];
        const deploymentFile = args["deployment"];

        // Validate required parameters
        if (!escrowUid) {
            console.error("❌ Error: --escrow-uid is required");
            console.error("Run with --help for usage information.");
            process.exit(1);
        }

        console.log("🔍 Checking Escrow Status\n");

        // Load deployment file (auto-detects current network if not specified)
        const deployment = loadDeploymentWithDefaults(deploymentFile);
        const addresses = deployment.addresses;

        console.log(`Configuration:`);
        console.log(`  📦 Escrow UID: ${escrowUid}`);
        console.log(`  🌐 Network: ${deployment.network}`);
        console.log(`  📡 RPC URL: ${deployment.rpcUrl}\n`);

        if (!addresses.eas) {
            console.error("❌ Error: EAS address not found in deployment file.");
            console.error("   Make sure you have a valid deployment file.");
            process.exit(1);
        }

        // Create public client
        const chain = getChainFromNetwork(deployment.network);
        const publicClient = createPublicClient({
            chain,
            transport: http(deployment.rpcUrl),
        });

        // Get escrow attestation
        console.log("📋 Fetching escrow details...\n");
        
        const escrow = await publicClient.readContract({
            address: addresses.eas as `0x${string}`,
            abi: contracts.IEAS.abi.abi,
            functionName: "getAttestation",
            args: [escrowUid as `0x${string}`],
        }) as any;

        console.log("📦 Escrow Information:");
        console.log(`   UID: ${escrow.uid}`);
        console.log(`   Schema: ${escrow.schema}`);
        console.log(`   Attester: ${escrow.attester}`);
        console.log(`   Recipient: ${escrow.recipient}`);
        console.log(`   Revoked: ${escrow.revocationTime > 0n ? "Yes ❌" : "No ✅"}`);
        
        // Try to decode the data
        try {
            const llmAbi = parseAbiParameters("(string demand, string arbitrationModel, address arbitrator)");
            const decoded = decodeAbiParameters(llmAbi, escrow.data);
            console.log(`\n📝 Escrow Details:`);
            console.log(`   Demand: "${decoded[0].demand}"`);
            console.log(`   Model: ${decoded[0].arbitrationModel}`);
            console.log(`   Arbitrator: ${decoded[0].arbitrator}`);
        } catch (e) {
            console.log(`\n📝 Raw Data: ${escrow.data}`);
        }

        // Check for fulfillments
        console.log(`\n🔎 Checking for fulfillments...`);
        
        // Get all Attested events
        const filter = await publicClient.createContractEventFilter({
            address: addresses.eas as `0x${string}`,
            abi: contracts.IEAS.abi.abi,
            eventName: "Attested",
            fromBlock: 0n,
        });

        const events = await publicClient.getFilterLogs({ filter });
        
        // Debug: log total events found
        console.log(`   Total events found: ${events.length}`);
        
        // Debug: show all refUIDs
        console.log(`   Debug - Looking for escrow UID: ${escrowUid.toLowerCase()}`);
        events.forEach((event: any, index: number) => {
            const refUID = event.args?.refUID;
            console.log(`   Event ${index}: refUID = ${refUID ? refUID.toLowerCase() : 'null'}, uid = ${event.args?.uid}`);
        });
        
        // Find fulfillments that reference this escrow
        const fulfillments = events.filter((event: any) => {
            const refUID = event.args?.refUID;
            // Compare as lowercase hex strings to avoid case sensitivity issues
            return refUID && refUID.toLowerCase() === escrowUid.toLowerCase();
        });

        console.log(`   Fulfillments matching escrow: ${fulfillments.length}`);

        if (fulfillments.length === 0) {
            console.log(`   No fulfillments found yet\n`);
        } else {
            console.log(`   Found ${fulfillments.length} fulfillment(s):\n`);
            
            for (const fulfillment of fulfillments) {
                const fulfillmentUid = fulfillment.args?.uid;
                if (!fulfillmentUid) continue;
                
                const fulfillmentAttestation = await publicClient.readContract({
                    address: addresses.eas as `0x${string}`,
                    abi: contracts.IEAS.abi.abi,
                    functionName: "getAttestation",
                    args: [fulfillmentUid],
                }) as any;

                console.log(`   📨 Fulfillment UID: ${fulfillmentUid}`);
                console.log(`      Attester: ${fulfillmentAttestation.attester}`);
                console.log(`      Revoked: ${fulfillmentAttestation.revocationTime > 0n ? "Yes ❌" : "No ✅"}`);
                
                // Try to decode fulfillment data
                try {
                    const fulfillmentAbi = parseAbiParameters("(string item)");
                    const fulfillmentData = decodeAbiParameters(fulfillmentAbi, fulfillmentAttestation.data);
                    console.log(`      Fulfillment Text: "${fulfillmentData[0].item}"`);
                } catch (e) {
                    // Skip if can't decode
                }
                
                // Check for arbitration decision
                const decisions = events.filter((e: any) => {
                    const refUID = e.args?.refUID;
                    return refUID && refUID.toLowerCase() === fulfillmentUid.toLowerCase();
                });
                if (decisions.length > 0) {
                    console.log(`      ⚖️  Arbitration: Decision recorded`);
                    for (const decision of decisions) {
                        const decisionUid = decision.args?.uid;
                        if (!decisionUid) continue;
                        
                        const decisionAttestation = await publicClient.readContract({
                            address: addresses.eas as `0x${string}`,
                            abi: contracts.IEAS.abi.abi,
                            functionName: "getAttestation",
                            args: [decisionUid],
                        }) as any;
                        
                        try {
                            const decisionAbi = parseAbiParameters("(bool item)");
                            const decisionData = decodeAbiParameters(decisionAbi, decisionAttestation.data);
                            console.log(`      Result: ${decisionData[0].item ? "✅ APPROVED" : "❌ REJECTED"}`);
                        } catch (e) {
                            console.log(`      Result: Unknown`);
                        }
                    }
                } else {
                    console.log(`      ⚖️  Arbitration: Pending...`);
                }
                console.log();
            }
        }

        console.log("✨ Status check complete!\n");

    } catch (error) {
        console.error("❌ Fatal error:", error);
        process.exit(1);
    }
}

// Run the script
main();
