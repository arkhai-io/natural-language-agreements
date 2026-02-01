/**
 * Shared utilities for NLA CLI
 */

import { foundry, sepolia, mainnet, baseSepolia } from "viem/chains";
import type { Chain } from "viem/chains";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { contractAddresses } from "alkahest-ts";

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
        case "devnet":
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
        // Default to devnet
        return 'devnet';
    }
    
    try {
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        return config.environment || 'devnet';
    } catch (e) {
        return 'devnet';
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
 * Get deployment path for environment
 */
export function getDeploymentPath(cliDir: string, env?: string): string {
    const environment = env || getCurrentEnvironment();
    const filename = `${environment}.json`;
    
    // Try multiple locations
    const paths = [
        join(cliDir, 'deployments', filename),  // dist/cli/deployments/
        join(process.cwd(), 'cli', 'deployments', filename),  // Project root
    ];
    
    for (const path of paths) {
        if (existsSync(path)) {
            return path;
        }
    }
    
    // Return the first path as default (even if it doesn't exist yet)
    return paths[0];
}

/**
 * Load deployment file and fill empty addresses with defaults from contractAddresses
 * If deploymentFilePath doesn't exist, tries to load deployment for current network
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
        const autoPath = getDeploymentPath(process.cwd(), currentEnv);
        
        if (existsSync(autoPath)) {
            actualPath = autoPath;
        } else if (!actualPath) {
            throw new Error(`No deployment file found for current environment: ${currentEnv}`);
        } else {
            throw new Error(`Deployment file not found: ${actualPath}`);
        }
    }

    const content = readFileSync(actualPath, "utf-8");
    const deployment = JSON.parse(content);
    
    let finalAddresses: Record<string, string> = deployment.addresses || {};
    const chainId = deployment.chainId;

    // If deployment addresses exist, merge with defaults
    if (deployment.addresses && Object.keys(deployment.addresses).length > 0) {
        // Check if we have default addresses for this chain
        if (contractAddresses[chainId]) {
            // Start with default addresses
            finalAddresses = { ...contractAddresses[chainId] };
            
            // Override with deployment addresses, but only if they're not empty strings
            for (const [key, value] of Object.entries(deployment.addresses)) {
                if (value && value !== "") {
                    finalAddresses[key] = value as string;
                }
            }
        }
    } else {
        // If no deployment addresses at all, use defaults if available
        if (contractAddresses[chainId]) {
            finalAddresses = { ...contractAddresses[chainId] };
        }
    }

    return {
        network: deployment.network,
        chainId: deployment.chainId,
        rpcUrl: deployment.rpcUrl,
        addresses: finalAddresses,
    };
}
