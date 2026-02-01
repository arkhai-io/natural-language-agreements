import { spawn, spawnSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, createWriteStream, unlinkSync } from "fs";
import { join } from "path";
import { getCurrentEnvironment, setCurrentEnvironment } from "../utils.js";

// Colors for console output
const colors = {
    green: '\x1b[32m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m'
};

// Load .env file if it exists
function loadEnvFile(envPath: string = '.env') {
    if (existsSync(envPath)) {
        console.log(`${colors.blue}📄 Loading .env file from: ${envPath}${colors.reset}`);
        const envContent = readFileSync(envPath, 'utf-8');
        const lines = envContent.split('\n');
        
        for (const line of lines) {
            // Skip comments and empty lines
            if (line.trim().startsWith('#') || !line.trim()) continue;
            
            // Parse key=value
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim();
                // Only set if not already in environment
                if (!process.env[key]) {
                    process.env[key] = value;
                }
            }
        }
        console.log(`${colors.green}✅ Environment variables loaded${colors.reset}`);
    } else if (envPath !== '.env') {
        // Only error if a custom path was specified but not found
        console.error(`${colors.red}❌ .env file not found at: ${envPath}${colors.reset}`);
        process.exit(1);
    }
}

// Helper to check if a command exists
function commandExists(command: string): boolean {
    try {
        const result = spawnSync(process.platform === 'win32' ? 'where' : 'which', [command], { 
            stdio: 'pipe' 
        });
        return result.status === 0;
    } catch {
        return false;
    }
}

// Helper to check if a port is in use
function isPortInUse(port: number): boolean {
    try {
        const result = spawnSync('lsof', ['-Pi', `:${port}`, '-sTCP:LISTEN', '-t'], {
            stdio: 'pipe'
        });
        return result.status === 0;
    } catch {
        return false;
    }
}

// Dev command - Start complete development environment
export async function runDevCommand(cliDir: string, envPath?: string) {
    console.log(`${colors.blue}════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.blue}  Natural Language Agreement Oracle - Quick Setup${colors.reset}`);
    console.log(`${colors.blue}════════════════════════════════════════════════════════${colors.reset}\n`);

    // Auto-switch to devnet environment
    const currentEnv = getCurrentEnvironment();
    if (currentEnv !== 'devnet') {
        console.log(`${colors.yellow}🔄 Switching environment from ${currentEnv} to devnet...${colors.reset}`);
        setCurrentEnvironment('devnet');
        console.log(`${colors.green}✅ Switched to devnet${colors.reset}\n`);
    } else {
        console.log(`${colors.green}✅ Already on devnet environment${colors.reset}\n`);
    }

    // Load .env file first
    loadEnvFile(envPath);
    console.log('');

    // Check prerequisites
    console.log(`${colors.blue}📋 Checking prerequisites...${colors.reset}\n`);

    // Check Bun
    if (!commandExists('bun')) {
        console.error(`${colors.red}❌ Bun is not installed${colors.reset}`);
        console.log('Please install it: https://bun.sh');
        process.exit(1);
    }
    console.log(`${colors.green}✅ Bun installed${colors.reset}`);

    // Check Foundry
    if (!commandExists('forge')) {
        console.error(`${colors.red}❌ Foundry (forge) is not installed${colors.reset}`);
        console.log('Please install it: https://book.getfoundry.sh/getting-started/installation');
        process.exit(1);
    }
    console.log(`${colors.green}✅ Foundry installed${colors.reset}`);

    // Check Anvil
    if (!commandExists('anvil')) {
        console.error(`${colors.red}❌ Anvil is not installed${colors.reset}`);
        console.log('Please install Foundry: https://book.getfoundry.sh/getting-started/installation');
        process.exit(1);
    }
    console.log(`${colors.green}✅ Anvil installed${colors.reset}`);

    // Check LLM API keys
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
    const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
    const hasPerplexity = !!process.env.PERPLEXITY_API_KEY;

    if (!hasOpenAI && !hasAnthropic && !hasOpenRouter && !hasPerplexity) {
        console.error(`${colors.red}❌ No LLM provider API key set${colors.reset}`);
        console.log('Please add at least one API key to your environment:');
        console.log('  export OPENAI_API_KEY=sk-...');
        console.log('  export ANTHROPIC_API_KEY=sk-ant-...');
        console.log('  export OPENROUTER_API_KEY=sk-or-...');
        process.exit(1);
    }

    if (hasOpenAI) console.log(`${colors.green}✅ OpenAI API key configured${colors.reset}`);
    if (hasAnthropic) console.log(`${colors.green}✅ Anthropic API key configured${colors.reset}`);
    if (hasOpenRouter) console.log(`${colors.green}✅ OpenRouter API key configured${colors.reset}`);
    if (hasPerplexity) console.log(`${colors.green}✅ Perplexity API key configured${colors.reset}`);
    console.log('');

    // Check if Anvil is already running
    if (isPortInUse(8545)) {
        console.log(`${colors.yellow}⚠️  Anvil is already running on port 8545${colors.reset}`);
        console.log(`${colors.blue}Using existing Anvil instance${colors.reset}\n`);
    } else {
        // Start Anvil
        console.log(`${colors.blue}🔨 Starting Anvil...${colors.reset}`);
        const anvilProcess = spawn('anvil', [], {
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: true
        });

        // Save PID
        writeFileSync('.anvil.pid', anvilProcess.pid!.toString());
        
        // Redirect output to log file
        const logStream = createWriteStream('anvil.log', { flags: 'a' });
        anvilProcess.stdout?.pipe(logStream);
        anvilProcess.stderr?.pipe(logStream);

        anvilProcess.unref();
        
        console.log(`${colors.green}✅ Anvil started (PID: ${anvilProcess.pid})${colors.reset}`);
        console.log('   Logs: tail -f anvil.log');
        
        // Wait for Anvil to be ready
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Deploy contracts
    console.log(`\n${colors.blue}📝 Deploying contracts...${colors.reset}\n`);
    const deployScript = join(cliDir, 'server', 'deploy.js');
    const deployResult = spawnSync('bun', ['run', deployScript, '--network', 'localhost', '--rpc-url', 'http://localhost:8545'], {
        stdio: 'inherit',
        cwd: process.cwd()
    });

    if (deployResult.status !== 0) {
        console.error(`${colors.red}❌ Deployment failed${colors.reset}`);
        process.exit(1);
    }

    // Start oracle
    console.log(`\n${colors.blue}🚀 Starting oracle...${colors.reset}\n`);
    const oracleScript = join(cliDir, 'server', 'oracle.js');
    
    // Look for deployment file in source directory (for local dev) or dist directory (for installed package)
    const sourcePath = join(process.cwd(), 'cli', 'deployments', 'devnet.json');
    const distPath = join(cliDir, 'deployments', 'devnet.json');
    const deploymentFile = existsSync(sourcePath) ? sourcePath : distPath;
    
    const oracleProcess = spawn('bun', ['run', oracleScript, '--deployment', deploymentFile], {
        stdio: 'inherit',
        cwd: process.cwd()
    });

    // Handle cleanup on exit
    const cleanup = () => {
        console.log(`\n${colors.yellow}🛑 Shutting down...${colors.reset}`);
        
        // Kill oracle
        oracleProcess.kill();
        
        // Kill Anvil
        try {
            const pidFile = '.anvil.pid';
            if (existsSync(pidFile)) {
                const pid = readFileSync(pidFile, 'utf-8').trim();
                try {
                    process.kill(parseInt(pid));
                    console.log(`${colors.green}✅ Anvil stopped${colors.reset}`);
                } catch (e) {
                    // Process might already be dead
                }
                unlinkSync(pidFile);
            }
        } catch (e) {
            // Ignore errors
        }
        
        process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // Open a new terminal
    console.log(`\n${colors.green}✅ Setup complete!${colors.reset}`);
    console.log(`${colors.blue}Opening new terminal...${colors.reset}\n`);
    
    try {
        // For macOS, open a new Terminal window
        if (process.platform === 'darwin') {
            spawn('osascript', [
                '-e',
                `tell application "Terminal" to do script "cd ${process.cwd()}"`
            ], { detached: true, stdio: 'ignore' }).unref();
        } 
        // For Linux, try common terminal emulators
        else if (process.platform === 'linux') {
            const terminals = ['gnome-terminal', 'konsole', 'xterm'];
            for (const term of terminals) {
                if (commandExists(term)) {
                    spawn(term, ['--working-directory', process.cwd()], { 
                        detached: true, 
                        stdio: 'ignore' 
                    }).unref();
                    break;
                }
            }
        }
        // For Windows
        else if (process.platform === 'win32') {
            spawn('cmd', ['/c', 'start', 'cmd', '/K', `cd /d ${process.cwd()}`], { 
                detached: true, 
                stdio: 'ignore' 
            }).unref();
        }
    } catch (e) {
        console.log(`${colors.yellow}⚠️  Could not open new terminal automatically${colors.reset}`);
    }

    // Keep process alive
    await new Promise(() => {});
}
