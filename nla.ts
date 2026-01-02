/**
 * Natural Language Agreement (NLA) Client
 * 
 * Supports multiple LLM providers for arbitration:
 * 
 * 1. OpenAI:
 *    - providerName: "OpenAI"
 *    - models: "gpt-4", "gpt-4-turbo", "gpt-3.5-turbo", etc.
 *    - Get API key from: https://platform.openai.com/api-keys
 * 
 * 2. Anthropic (Claude):
 *    - providerName: "Anthropic" or "Claude"
 *    - models: "claude-3-5-sonnet-20241022", "claude-3-opus-20240229", etc.
 *    - Get API key from: https://console.anthropic.com/
 * 
 * 3. OpenRouter:
 *    - providerName: "OpenRouter"
 *    - models: Any model available on OpenRouter (e.g., "openai/gpt-4", "anthropic/claude-3-opus")
 *    - Get API key from: https://openrouter.ai/keys
 *    - baseURL: "https://openrouter.ai/api/v1" (default)
 * 
 * Example usage:
 * ```typescript
 * const llmClient = makeLLMClient([]);
 * 
 * // Add OpenAI provider
 * llmClient.addProvider({
 *   providerName: "OpenAI",
 *   apiKey: "sk-..."
 * });
 * 
 * // Add Anthropic provider
 * llmClient.addProvider({
 *   providerName: "Anthropic",
 *   apiKey: "sk-ant-..."
 * });
 * 
 * // Add OpenRouter provider
 * llmClient.addProvider({
 *   providerName: "OpenRouter",
 *   apiKey: "sk-or-...",
 *   baseURL: "https://openrouter.ai/api/v1"
 * });
 * ```
 */

import {
    decodeAbiParameters,
    encodeAbiParameters,
    parseAbiParameters,
} from "viem";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";


export type LLMProvider = {
    providerName: string;
    apiKey?: string;
    baseURL?: string; // For OpenRouter or custom endpoints
};

export type LLMDemand = {
    arbitrationProvider: string;
    arbitrationModel: string;
    arbitrationPrompt: string;
    demand: string;
};

export const makeLLMClient = (
    providers: LLMProvider[],
) => {

    const LLMAbi = parseAbiParameters(
        "(string arbitrationProvider, string arbitrationModel, string arbitrationPrompt, string demand)",
    );
    const encodeDemand = (demand: LLMDemand) => {
        return encodeAbiParameters(
            LLMAbi,
            [demand],
        );
    };

    const arbitrate = async (demand: LLMDemand, obligation: string): Promise<boolean> => {
        try {
            const matchingProvider = providers.find(provider =>
                provider.providerName.toLowerCase().includes(demand.arbitrationProvider.toLowerCase()) ||
                demand.arbitrationProvider.toLowerCase().includes(provider.providerName.toLowerCase())
            );

            const selectedProvider = matchingProvider || providers[0];

            if (!selectedProvider) {
                throw new Error('No LLM provider available');
            }

            console.log(`Using provider: ${selectedProvider.providerName} for arbitration demand: ${JSON.stringify(demand)}`);
            
            // Replace placeholders with actual values
            const promptTemplate = `${demand.arbitrationPrompt}`
                .replace(/\{\{demand\}\}/g, demand.demand)
                .replace(/\{\{obligation\}\}/g, obligation);

            const systemPrompt = "You are an arbitrator that always tells the truth. You must respond with only 'true' or 'false' - no other words or explanations.";
            const userPrompt = `${promptTemplate}
Based on the above information, determine if the fulfillment satisfies the demand.
Answer ONLY with 'true' or 'false' - no explanations or additional text.`;

            let text: string;
            const providerName = selectedProvider.providerName.toLowerCase();

            if (providerName === 'openai' || providerName.includes('openai')) {
                const openai = createOpenAI({
                    apiKey: selectedProvider.apiKey,
                    baseURL: selectedProvider.baseURL,
                });

                const result = await generateText({
                    model: openai(demand.arbitrationModel),
                    system: systemPrompt,
                    prompt: userPrompt,
                });
                text = result.text;

            } else if (providerName === 'anthropic' || providerName.includes('anthropic') || providerName.includes('claude')) {
                const anthropic = createAnthropic({
                    apiKey: selectedProvider.apiKey,
                    baseURL: selectedProvider.baseURL,
                });

                const result = await generateText({
                    model: anthropic(demand.arbitrationModel),
                    system: systemPrompt,
                    prompt: userPrompt,
                });
                text = result.text;

            } else if (providerName === 'openrouter' || providerName.includes('openrouter')) {
                // OpenRouter uses OpenAI-compatible API
                const openrouter = createOpenAI({
                    apiKey: selectedProvider.apiKey,
                    baseURL: selectedProvider.baseURL,
                });

                const result = await generateText({
                    model: openrouter(demand.arbitrationModel),
                    system: systemPrompt,
                    prompt: userPrompt,
                });
                text = result.text;

            } else {
                throw new Error(`Unsupported provider: ${selectedProvider.providerName}`);
            }

            console.log(`LLM Response: ${text}`);

            const cleanedResponse = text.trim().toLowerCase();
            return cleanedResponse === 'true';

        } catch (error) {
            console.error('Error in LLM arbitration:', error);
            throw new Error(`LLM arbitration failed: ${error}`);
        }
    };

    const addProvider = (provider: LLMProvider): void => {
        providers.push(provider);
    };

    const getProvider = (providerName: string): LLMProvider | undefined => {
        return providers.find(provider => provider.providerName.toLowerCase() === providerName.toLowerCase());
    };

    return {
        LLMAbi,
        arbitrate,
        encodeDemand,
        addProvider,
        getProvider,
        providers,
    };
};
