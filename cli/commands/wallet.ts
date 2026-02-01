/**
 * Wallet management commands
 */

import { setPrivateKey, clearPrivateKey, getPrivateKey } from "../utils.js";
import { privateKeyToAddress } from "viem/accounts";

/**
 * Set wallet private key
 */
export async function setWallet(privateKey: string): Promise<void> {
    // Validate private key format
    if (!privateKey.startsWith('0x')) {
        console.error('❌ Private key must start with 0x');
        process.exit(1);
    }

    if (privateKey.length !== 66) {
        console.error('❌ Invalid private key length. Expected 66 characters (0x + 64 hex chars)');
        process.exit(1);
    }

    try {
        // Validate by deriving address
        const address = privateKeyToAddress(privateKey as `0x${string}`);
        
        // Store in config
        setPrivateKey(privateKey);
        
        console.log('✅ Wallet configured successfully');
        console.log(`📍 Address: ${address}`);
        console.log('\n💡 Your private key is stored in ~/.nla/config.json');
        console.log('   It will be used automatically for all transactions');
    } catch (error) {
        console.error('❌ Invalid private key format');
        process.exit(1);
    }
}

/**
 * Show current wallet address
 */
export async function showWallet(): Promise<void> {
    const privateKey = getPrivateKey();
    
    if (!privateKey) {
        console.log('ℹ️  No wallet configured');
        console.log('\n💡 Set your wallet with:');
        console.log('   nla wallet:set --private-key <your-key>');
        return;
    }

    try {
        const address = privateKeyToAddress(privateKey as `0x${string}`);
        console.log('✅ Wallet configured');
        console.log(`📍 Address: ${address}`);
    } catch (error) {
        console.error('❌ Invalid private key in config');
        console.log('\n💡 Update your wallet with:');
        console.log('   nla wallet:set --private-key <your-key>');
    }
}

/**
 * Clear wallet from config
 */
export async function clearWallet(): Promise<void> {
    clearPrivateKey();
    console.log('✅ Wallet cleared from config');
    console.log('\n💡 Set a new wallet with:');
    console.log('   nla wallet:set --private-key <your-key>');
}
