#!/usr/bin/env node
import { parseArgs } from "util";
import { spawnSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import { createPublicClient, http, parseAbiParameters, decodeAbiParameters } from "viem";
import { foundry } from "viem/chains";
import { contracts } from "alkahest-ts";

import { runDevCommand } from "./commands/dev.js";
import { runStopCommand } from "./commands/stop.js";
import { runSwitchCommand } from "./commands/switch.js";
import { setWallet, showWallet, clearWallet } from "./commands/wallet.js";

// Get the directory name for ESM modules (compatible with both Node and Bun)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
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
  switch [env]     Switch between environments (anvil, sepolia, base-sepolia, mainnet)
  network          Show current network/environment
  wallet:set       Set wallet private key
  wallet:show      Show current wallet address
  wallet:clear     Clear wallet from config
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
  --env <file>                 Path to .env file (dev, default: .env)

Environment Variables:
  PRIVATE_KEY                  Private key for transactions
  RPC_URL                      RPC URL for blockchain network
  OPENAI_API_KEY               OpenAI API key (for create command)

Examples:
  # Start development environment
  nla dev

  # Start development with custom .env file
  nla dev --env /path/to/.env.production

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
    const args = process.argv.slice(2);
    
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
            "env": { type: "string" },
            "environment": { type: "string" },
            "help": { type: "boolean", short: "h" },
        },
        strict: command !== "switch" && command !== "network", // Allow positional args for switch command
        allowPositionals: command === "switch" || command === "network",
    });

    return { command, ...values };
}

// Server command handler (for deploy.ts, oracle.ts)
async function runServerCommand(scriptName: string, args: string[] = []) {
    const scriptPath = join(__dirname, "server", scriptName);
    
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

        // Handle dev and stop commands
        if (command === "dev") {
            await runDevCommand(__dirname, args.env as string | undefined, args["private-key"] as string | undefined);
            return;
        }
        
        if (command === "stop") {
            await runStopCommand();
            return;
        }

        if (command === "switch") {
            // Get environment from either --environment flag or second positional arg
            const env = args.environment as string | undefined || process.argv[3];
            runSwitchCommand(env);
            return;
        }

        if (command === "network") {
            // Show current network (same as switch with no args)
            runSwitchCommand();
            return;
        }

        // Handle wallet commands
        if (command === "wallet:set") {
            const privateKey = args["private-key"] as string | undefined;
            if (!privateKey) {
                console.error("❌ Missing required option: --private-key");
                process.exit(1);
            }
            await setWallet(privateKey);
            return;
        }

        if (command === "wallet:show") {
            await showWallet();
            return;
        }

        if (command === "wallet:clear") {
            await clearWallet();
            return;
        }

        // Handle TypeScript commands that can run directly
        if (command === "deploy") {
            await runServerCommand("deploy.js", process.argv.slice(3));
            return;
        }
        
        if (command === "start-oracle") {
            await runServerCommand("oracle.js", process.argv.slice(3));
            return;
        }

        // Get the script path based on command
        let scriptPath: string;
        
        switch (command) {
            case "escrow:create":
                scriptPath = "./client/create-escrow.js";
                break;
            case "escrow:fulfill":
                scriptPath = "./client/fulfill-escrow.js";
                break;
            case "escrow:collect":
                scriptPath = "./client/collect-escrow.js";
                break;
            case "escrow:status":
                scriptPath = "./client/status-escrow.js";
                break;
            default:
                console.error(`❌ Unknown command: ${command}`);
                console.error("Run 'nla help' for usage information.");
                process.exit(1);
        }

        // Run the command as a subprocess with the args (excluding the command name)
        const { spawnSync } = await import("child_process");
        const fullScriptPath = join(__dirname, scriptPath);
        
        // Build args array without the command name
        const commandArgs = process.argv.slice(3); // Skip node, script, and command
        
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

// Run the CLI
main();
