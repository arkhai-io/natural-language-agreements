/**
 * Shared utilities for NLA CLI
 */

import { foundry, sepolia, mainnet, baseSepolia } from "viem/chains";
import type { Chain } from "viem/chains";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { contractAddresses } from "alkahest-ts";
import { fileURLToPath } from "url";

// Get the directory of this utils file (dist/cli or cli/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load .env file and set environment variables
 */
export function loadEnvFile(envPath: string): void {
    if (!existsSync(envPath)) {
        throw new Error(`.env file not found: ${envPath}`);
    }

    const content = readFileSync(envPath, "utf-8");
    const lines = content.split("\n");

    for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith("#")) {
            continue;
        }

        // Parse KEY=VALUE format
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            let value = match[2].trim();

            // Remove surrounding quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) || 
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }

            // Only set if not already set
            if (!process.env[key]) {
                process.env[key] = value;
            }
        }
    }
}

/**
 * Get viem chain configuration from network name
 */
export function getChainFromNetwork(network: string): Chain {
    // Normalize the network name: lowercase and replace spaces with dashes
    const normalized = network.toLowerCase().replace(/\s+/g, '-');
    
    switch (normalized) {
        case "localhost":
        case "anvil":
            return foundry;
        case "sepolia":
        case "ethereum-sepolia":
            return sepolia;
        case "base-sepolia":
            return baseSepolia;
        case "mainnet":
        case "ethereum":
            return mainnet;
        default:
            return foundry;
    }
}

/**
 * Get NLA config directory (~/.nla)
 */
export function getNLAConfigDir(): string {
    const configDir = join(homedir(), '.nla');
    if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
    }
    return configDir;
}

/**
 * Get current environment from config
 */
export function getCurrentEnvironment(): string {
    const configPath = join(getNLAConfigDir(), 'config.json');
    
    if (!existsSync(configPath)) {
        // Default to anvil
        return 'anvil';
    }
    
    try {
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        return config.environment || 'anvil';
    } catch (e) {
        return 'anvil';
    }
}

/**
 * Set current environment in config
 */
export function setCurrentEnvironment(env: string): void {
    const configPath = join(getNLAConfigDir(), 'config.json');
    const config = existsSync(configPath) 
        ? JSON.parse(readFileSync(configPath, 'utf-8'))
        : {};
    
    config.environment = env;
    writeFileSync(configPath, JSON.stringify(config, null, 2));
}

/**
 * Get private key from config or environment
 */
export function getPrivateKey(): string | undefined {
    // First check environment variable
    if (process.env.PRIVATE_KEY) {
        return process.env.PRIVATE_KEY;
    }
    
    // Then check config file
    const configPath = join(getNLAConfigDir(), 'config.json');
    if (!existsSync(configPath)) {
        return undefined;
    }
    
    try {
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        return config.privateKey;
    } catch (e) {
        return undefined;
    }
}

/**
 * Set private key in config
 */
export function setPrivateKey(privateKey: string): void {
    const configPath = join(getNLAConfigDir(), 'config.json');
    const config = existsSync(configPath) 
        ? JSON.parse(readFileSync(configPath, 'utf-8'))
        : {};
    
    config.privateKey = privateKey;
    writeFileSync(configPath, JSON.stringify(config, null, 2));
}

/**
 * Clear private key from config
 */
export function clearPrivateKey(): void {
    const configPath = join(getNLAConfigDir(), 'config.json');
    if (!existsSync(configPath)) {
        return;
    }
    
    try {
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        delete config.privateKey;
        writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (e) {
        // Ignore errors
    }
}

/**
 * Get deployment path for environment
 * Automatically looks in the CLI directory where utils.ts is located
 * @param env - The environment name (anvil, sepolia, etc.)
 */
export function getDeploymentPath(env?: string): string {
    const environment = env || getCurrentEnvironment();
    const filename = `${environment}.json`;
    
    // When deployed via npm, utils.js will be in dist/cli/
    // and deployment files will be in dist/cli/deployments/
    const deploymentPath = join(__dirname, 'deployments', filename);
    
    return deploymentPath;
}

/**
 * Load deployment file and fill empty addresses with defaults from contractAddresses
 * If deploymentFilePath doesn't exist, tries to load deployment for current network
 * @param deploymentFilePath - Optional path to deployment file
 */
export function loadDeploymentWithDefaults(deploymentFilePath?: string): {
    network: string;
    chainId: number;
    rpcUrl: string;
    addresses: Record<string, string>;
} {
    let actualPath = deploymentFilePath;
    
    // If no path provided or path doesn't exist, try current network
    if (!actualPath || !existsSync(actualPath)) {
        const currentEnv = getCurrentEnvironment();
        const autoPath = getDeploymentPath(currentEnv);
        
        if (existsSync(autoPath)) {
            actualPath = autoPath;
        } else if (!actualPath) {
            throw new Error(`No deployment file found for current environment: ${currentEnv}. Try running from the project directory or use --deployment <file>`);
        } else {
            throw new Error(`Deployment file not found: ${actualPath}`);
        }
    }

    const content = readFileSync(actualPath, "utf-8");
    const deployment = JSON.parse(content);
    
    let finalAddresses: Record<string, string> = {};
    
    // Start with default addresses from contractAddresses if available
    // contractAddresses is indexed by chain name (e.g., "Base Sepolia", "foundry")
    const chainName = deployment.network;
    if (contractAddresses[chainName]) {
        finalAddresses = { ...contractAddresses[chainName] };
    }

    // Override with deployment addresses, but only if they're not empty strings
    if (deployment.addresses && Object.keys(deployment.addresses).length > 0) {
        for (const [key, value] of Object.entries(deployment.addresses)) {
            if (value && value !== "") {
                finalAddresses[key] = value as string;
            }
        }
    }

    return {
        network: deployment.network,
        chainId: deployment.chainId,
        rpcUrl: deployment.rpcUrl,
        addresses: finalAddresses,
    };
}
