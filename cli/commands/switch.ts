import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors for console output
const colors = {
    green: '\x1b[32m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m'
};

// Get NLA config directory
function getNLAConfigDir(): string {
    const configDir = join(homedir(), '.nla');
    if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
    }
    return configDir;
}

// Get current environment
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

// Set current environment
function setCurrentEnvironment(env: string): void {
    const configPath = join(getNLAConfigDir(), 'config.json');
    const config = existsSync(configPath) 
        ? JSON.parse(readFileSync(configPath, 'utf-8'))
        : {};
    
    config.environment = env;
    writeFileSync(configPath, JSON.stringify(config, null, 2));
}

// Get deployment path for environment
export function getDeploymentPath(cliDir: string, env?: string): string {
    const environment = env || getCurrentEnvironment();
    const filename = `${environment}.json`;
    
    // Try multiple locations
    const paths = [
        join(cliDir, 'deployments', filename),  // dist/cli/deployments/
        join(__dirname, '..', 'deployments', filename),  // Relative to switch.ts
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

// Switch command
export function runSwitchCommand(env?: string) {
    console.log(`${colors.blue}════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.blue}  Natural Language Agreement - Environment Switch${colors.reset}`);
    console.log(`${colors.blue}════════════════════════════════════════════════════════${colors.reset}\n`);

    // If no environment specified, show current
    if (!env) {
        const current = getCurrentEnvironment();
        console.log(`${colors.blue}Current environment:${colors.reset} ${colors.green}${current}${colors.reset}\n`);
        console.log('Available environments:');
        console.log('  • devnet       (local Anvil blockchain)');
        console.log('  • sepolia      (Ethereum Sepolia testnet)');
        console.log('  • base-sepolia (Base Sepolia testnet)');
        console.log('  • mainnet      (Ethereum mainnet)\n');
        console.log(`${colors.yellow}Usage:${colors.reset} nla switch <environment>`);
        console.log(`${colors.yellow}Example:${colors.reset} nla switch sepolia\n`);
        return;
    }

    // Validate environment
    const validEnvs = ['devnet', 'sepolia', 'base-sepolia', 'mainnet'];
    if (!validEnvs.includes(env)) {
        console.error(`${colors.red}❌ Invalid environment: ${env}${colors.reset}`);
        console.log('Valid environments: devnet, sepolia, base-sepolia, mainnet\n');
        process.exit(1);
    }

    // Switch environment
    const currentEnv = getCurrentEnvironment();
    
    if (currentEnv === env) {
        console.log(`${colors.yellow}⚠️  Already on ${env}${colors.reset}\n`);
        return;
    }

    setCurrentEnvironment(env);
    console.log(`${colors.green}✅ Switched to ${env}${colors.reset}\n`);
    
    // Show info about the environment
    if (env === 'devnet') {
        console.log('📝 Using local Anvil blockchain (http://localhost:8545)');
        console.log('   Run "nla dev" to start the development environment\n');
    } else if (env === 'sepolia') {
        console.log('📝 Using Ethereum Sepolia testnet');
        console.log('   Make sure you have deployed contracts and updated sepolia.json\n');
    } else if (env === 'base-sepolia') {
        console.log('📝 Using Base Sepolia testnet');
        console.log('   Make sure you have deployed contracts and updated base-sepolia.json\n');
    } else if (env === 'mainnet') {
        console.log('📝 Using Ethereum mainnet');
        console.log(`   ${colors.yellow}⚠️  WARNING: This is production! Use with caution.${colors.reset}\n`);
    }
}
