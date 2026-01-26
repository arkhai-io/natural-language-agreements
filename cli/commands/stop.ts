import { spawnSync } from "child_process";
import { existsSync, readFileSync, unlinkSync } from "fs";

// Colors for console output
const colors = {
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    reset: '\x1b[0m'
};

// Stop command - Stop all services
export async function runStopCommand() {
    console.log(`${colors.yellow}🛑 Stopping services...${colors.reset}\n`);

    // Stop Anvil
    try {
        const pidFile = '.anvil.pid';
        if (existsSync(pidFile)) {
            const pid = readFileSync(pidFile, 'utf-8').trim();
            try {
                process.kill(parseInt(pid));
                console.log(`${colors.green}✅ Anvil stopped${colors.reset}`);
            } catch (e) {
                console.log(`${colors.yellow}⚠️  Anvil process not found (may have already stopped)${colors.reset}`);
            }
            unlinkSync(pidFile);
        } else {
            console.log(`${colors.yellow}⚠️  No Anvil PID file found${colors.reset}`);
        }
    } catch (e) {
        console.error(`${colors.red}❌ Error stopping Anvil:${colors.reset}`, e);
    }

    // Try to kill any remaining processes on port 8545
    try {
        spawnSync('pkill', ['-f', 'anvil']);
    } catch (e) {
        // Ignore
    }

    console.log(`\n${colors.green}✅ Services stopped${colors.reset}`);
}
