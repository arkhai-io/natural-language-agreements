/**
 * Shared utilities for NLA CLI
 */

import { foundry, sepolia, mainnet, baseSepolia } from "viem/chains";
import type { Chain } from "viem/chains";

/**
 * Get viem chain configuration from network name
 */
export function getChainFromNetwork(network: string): Chain {
    switch (network.toLowerCase()) {
        case "localhost":
        case "devnet":
            return foundry;
        case "sepolia":
            return sepolia;
        case "base-sepolia":
            return baseSepolia;
        case "mainnet":
            return mainnet;
        default:
            return foundry;
    }
}
