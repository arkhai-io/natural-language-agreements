#!/usr/bin/env bun
import { parseArgs } from "util";
import { spawnSync } from "child_process";
import { existsSync, readFileSync } from "fs";

import { createPublicClient, http, parseAbiParameters, decodeAbiParameters } from "viem";
import { foundry } from "viem/chains";
import { contracts } from "alkahest-ts";
// Helper function to display usage
function displayHelp() {
    console.log(`
Natural Language Agreement CLI

Usage:
  nla <command> [options]

Commands:
  dev              Start local development environment (Anvil + Deploy + Oracle)
  deploy           Deploy contracts to blockchain
  start-oracle     Start the oracle service
  stop             Stop all services (Anvil + Oracle)
  escrow:create    Create a new escrow with natural language demand
  escrow:fulfill   Fulfill an existing escrow
  escrow:collect   Collect an approved escrow
  escrow:status    Check the status of an escrow
  help             Display this help message

Options (vary by command):
  --demand <text>              Natural language demand (create)
  --amount <number>            Amount of tokens to escrow (create)
  --token <address>            ERC20 token contract address (create)
  --oracle <address>           Oracle address (create, fulfill)
  --escrow-uid <uid>           Escrow UID (fulfill, collect, status)
  --fulfillment <text>         Fulfillment text (fulfill)
  --fulfillment-uid <uid>      Fulfillment UID (collect)
  --private-key <key>          Private key (all commands)
  --rpc-url <url>              RPC URL (default: http://localhost:8545)
  --deployment <file>          Load addresses from deployment file
  --arbitration-provider <name> Arbitration provider (create, default: OpenAI)
  --arbitration-model <model>  Arbitration model (create, default: gpt-4o-mini)
  --arbitration-prompt <text>  Custom arbitration prompt (create, optional)

Environment Variables:
  PRIVATE_KEY                  Private key for transactions
  RPC_URL                      RPC URL for blockchain network
  OPENAI_API_KEY               OpenAI API key (for create command)

Examples:
  # Start development environment
  nla dev

  # Deploy contracts
  nla deploy

  # Start oracle
  nla start-oracle

  # Stop all services
  nla stop

  # Create an escrow
  nla escrow:create \\
    --demand "The sky is blue" \\
    --amount 10 \\
    --token 0xa513E6E4b8f2a923D98304ec87F64353C4D5C853 \\
    --oracle 0x70997970C51812dc3A010C7d01b50e0d17dc79C8

  # Fulfill an escrow
  nla escrow:fulfill \\
    --escrow-uid 0x... \\
    --fulfillment "The sky appears blue today" \\
    --oracle 0x70997970C51812dc3A010C7d01b50e0d17dc79C8

  # Collect an escrow
  nla escrow:collect \\
    --escrow-uid 0x... \\
    --fulfillment-uid 0x...

  # Check escrow status
  nla escrow:status --escrow-uid 0x...
`);
}

// Parse command line arguments
function parseCliArgs() {
    const args = Bun.argv.slice(2);
    
    if (args.length === 0) {
        displayHelp();
        process.exit(0);
    }

    const command = args[0];

    if (command === "help" || command === "--help" || command === "-h") {
        displayHelp();
        process.exit(0);
    }

    const { values } = parseArgs({
        args: args.slice(1),
        options: {
            "demand": { type: "string" },
            "amount": { type: "string" },
            "token": { type: "string" },
            "oracle": { type: "string" },
            "escrow-uid": { type: "string" },
            "fulfillment": { type: "string" },
            "fulfillment-uid": { type: "string" },
            "private-key": { type: "string" },
            "rpc-url": { type: "string" },
            "deployment": { type: "string" },
            "arbitration-provider": { type: "string" },
            "arbitration-model": { type: "string" },
            "arbitration-prompt": { type: "string" },
        },
        strict: true,
    });

    return { command, ...values };
}

// Shell command handler
async function runShellCommand(scriptName: string, args: string[] = []) {
    const { spawnSync } = await import("child_process");
    const scriptDir = import.meta.dir;
    const scriptPath = `${scriptDir}/scripts/${scriptName}`;
    
    // Run the shell script
    const result = spawnSync(scriptPath, args, {
        stdio: "inherit",
        cwd: process.cwd(),
        shell: true,
    });

    process.exit(result.status || 0);
}

// Server command handler (for deploy.ts, oracle.ts)
async function runServerCommand(scriptName: string, args: string[] = []) {
    const { spawnSync } = await import("child_process");
    const scriptDir = import.meta.dir;
    const scriptPath = `${scriptDir}/server/${scriptName}`;
    
    // Run the TypeScript file directly
    const result = spawnSync("bun", ["run", scriptPath, ...args], {
        stdio: "inherit",
        cwd: process.cwd(),
    });

    process.exit(result.status || 0);
}

// Main function
async function main() {
    try {
        const args = parseCliArgs();
        const command = args.command;

        // Handle shell script commands (dev and stop need shell for process management)
        if (command === "dev") {
            await runShellCommand("dev.sh");
            return;
        }
        
        if (command === "stop") {
            await runShellCommand("stop.sh");
            return;
        }

        // Handle TypeScript commands that can run directly
        if (command === "deploy") {
            await runServerCommand("deploy.ts", Bun.argv.slice(3));
            return;
        }
        
        if (command === "start-oracle") {
            await runServerCommand("oracle.ts", Bun.argv.slice(3));
            return;
        }

        // Get the script path based on command
        let scriptPath: string;
        
        switch (command) {
            case "escrow:create":
                scriptPath = "./client/create-escrow.ts";
                break;
            case "escrow:fulfill":
                scriptPath = "./client/fulfill-escrow.ts";
                break;
            case "escrow:collect":
                scriptPath = "./client/collect-escrow.ts";
                break;
            case "escrow:status":
                await runStatusCommand(args);
                return;
            default:
                console.error(`❌ Unknown command: ${command}`);
                console.error("Run 'nla help' for usage information.");
                process.exit(1);
        }

        // Run the command as a subprocess with the args (excluding the command name)
        const { spawnSync } = await import("child_process");
        const scriptDir = import.meta.dir;
        const fullScriptPath = `${scriptDir}/${scriptPath}`;
        
        // Build args array without the command name
        const commandArgs = Bun.argv.slice(3); // Skip bun, script, and command
        
        const result = spawnSync("bun", ["run", fullScriptPath, ...commandArgs], {
            stdio: "inherit",
            cwd: process.cwd(),
        });

        process.exit(result.status || 0);
        
    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
}

// Status command handler
async function runStatusCommand(args: any) {
    const escrowUid = args["escrow-uid"];
    const rpcUrl = args["rpc-url"] || process.env.RPC_URL || "http://localhost:8545";
    const deploymentFile = args["deployment"];

    if (!escrowUid) {
        console.error("❌ Error: --escrow-uid is required for status command");
        process.exit(1);
    }

    console.log("🔍 Checking Escrow Status\n");
    console.log(`Configuration:`);
    console.log(`  📦 Escrow UID: ${escrowUid}`);
    console.log(`  🌐 RPC URL: ${rpcUrl}\n`);

    // Import required modules
    const { createPublicClient, http, parseAbiParameters } = await import("viem");
    const { foundry } = await import("viem/chains");
    const { existsSync, readFileSync } = await import("fs");

    // Load deployment addresses
    let addresses: any = {};
    if (deploymentFile && existsSync(deploymentFile)) {
        const deployment = JSON.parse(readFileSync(deploymentFile, "utf-8"));
        addresses = deployment.addresses;
    }

    // Create public client
    const publicClient = createPublicClient({
        chain: foundry,
        transport: http(rpcUrl),
    });


    if (!addresses.eas) {
        console.error("❌ Error: EAS address not found. Use --deployment to specify deployment file.");
        process.exit(1);
    }

    // Get escrow attestation
    console.log("📋 Fetching escrow details...\n");
    
    const escrow = await publicClient.readContract({
        address: addresses.eas,
        abi: contracts.IEAS.abi.abi,
        functionName: "getAttestation",
        args: [escrowUid],
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
        const decoded = await import("viem").then(m => 
            m.decodeAbiParameters(llmAbi, escrow.data)
        );
        console.log(`\n📝 Escrow Details:`);
        console.log(`   Demand: "${decoded[0].demand}"`);
        console.log(`   Model: ${decoded[0].arbitrationModel}`);
        console.log(`   Arbitrator: ${decoded[0].arbitrator}`);
    } catch (e) {
        console.log(`\n📝 Raw Data: ${escrow.data}`);
    }

    // Check for fulfillments
    console.log(`\n🔎 Checking for fulfillments...`);
    
    const filter = await publicClient.createContractEventFilter({
        address: addresses.eas,
        abi: contracts.IEAS.abi.abi,
        eventName: "Attested",
        fromBlock: 0n,
    });

    const events = await publicClient.getFilterLogs({ filter });
    
    // Find fulfillments that reference this escrow
    const fulfillments = events.filter((event: any) => {
        return (event as any).args?.refUID === escrowUid;
    });

    if (fulfillments.length === 0) {
        console.log(`   No fulfillments found yet`);
    } else {
        console.log(`   Found ${fulfillments.length} fulfillment(s):\n`);
        
        for (const fulfillment of fulfillments) {
            const fulfillmentUid = (fulfillment as any).args?.uid;
            const fulfillmentAttestation = await publicClient.readContract({
                address: addresses.eas,
                abi: contracts.IEAS.abi.abi,
                functionName: "getAttestation",
                args: [fulfillmentUid],
            }) as any;

            console.log(`   📨 Fulfillment UID: ${fulfillmentUid}`);
            console.log(`      Attester: ${fulfillmentAttestation.attester}`);
            console.log(`      Revoked: ${fulfillmentAttestation.revocationTime > 0n ? "Yes ❌" : "No ✅"}`);
            
            // Check for arbitration decision
            const decisions = events.filter((e: any) => (e as any).args?.refUID === fulfillmentUid);
            if (decisions.length > 0) {
                console.log(`      ⚖️  Arbitration: Decision recorded`);
                for (const decision of decisions) {
                    const decisionUid = (decision as any).args?.uid;
                    const decisionAttestation = await publicClient.readContract({
                        address: addresses.eas,
                        abi: contracts.IEAS.abi.abi,
                        functionName: "getAttestation",
                        args: [decisionUid],
                    }) as any;
                    
                    try {
                        const decisionAbi = parseAbiParameters("(bool item)");
                        const decisionData = await import("viem").then(m => 
                            m.decodeAbiParameters(decisionAbi, decisionAttestation.data)
                        );
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
}

// Run the CLI
main();
