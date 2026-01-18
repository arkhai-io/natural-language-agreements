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
import { generateText, stepCountIs } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { perplexitySearch } from '@perplexity-ai/ai-sdk';

export enum ProviderName {
    OpenAI = "OpenAI",
    Anthropic = "Anthropic",
    OpenRouter = "OpenRouter",
}

export type LLMProvider = {
    providerName: ProviderName | string;
    apiKey?: string;
    baseURL?: string; // For OpenRouter or custom endpoints
    perplexityApiKey?: string; // For Perplexity AI
};

export type LLMDemand = {
    arbitrationProvider: string;
    arbitrationModel: string;
    arbitrationPrompt: string;
    demand: string;
};

const cleanBool = (raw: string) => {
  let t = raw.trim().toLowerCase();

  // strip <tag>... </tag>
  t = t.replace(/<\/?[^>]+(>|$)/g, "").trim();

  // strip code fences
  t = t.replace(/```[\s\S]*?```/g, "").trim();

  // strip result: and similar prefixes
  t = t.replace(/^(result:|answer:)\s*/g, "").trim();

  return t;
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

    const decodeDemand = (data: `0x${string}`): LLMDemand => {
        const decoded = decodeAbiParameters(LLMAbi, data);
        return decoded[0];
    };

    const arbitrate = async (demand: LLMDemand, obligation: string): Promise<boolean> => {
        try {
            console.log(demand);
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
            if (providerName === ProviderName.OpenAI.toLowerCase() || providerName.includes('openai')) {
                const openai = createOpenAI({
                    apiKey: selectedProvider.apiKey,
                    baseURL: selectedProvider.baseURL,
                });

                const result = await generateText({
                    model: openai(demand.arbitrationModel),
                    tools: {
                        web_search: openai.tools.webSearch({}),
                    },
                    system: systemPrompt,
                    prompt: userPrompt,
                });
                text = result.text;

            } else if (providerName === ProviderName.Anthropic.toLowerCase() || providerName.includes('anthropic') || providerName.includes('claude')) {
                const anthropic = createAnthropic({
                    apiKey: selectedProvider.apiKey,
                    baseURL: selectedProvider.baseURL,
                });

                const result = await generateText({
                    model: anthropic(demand.arbitrationModel),
                   tools: {
                        search: perplexitySearch({apiKey: selectedProvider.perplexityApiKey}),
                    },
                    system: systemPrompt,
                    prompt: userPrompt,
                   
                });
                text = result.text;

            } else if (providerName === ProviderName.OpenRouter.toLowerCase() || providerName.includes('openrouter')) {
                // OpenRouter uses OpenAI-compatible API
                const openrouter = createOpenRouter({
                    apiKey: selectedProvider.apiKey,
                    baseURL: selectedProvider.baseURL,
                });

                const result = await generateText({
                    model: openrouter.chat(demand.arbitrationModel),
                    tools: {
                        search: perplexitySearch({apiKey: selectedProvider.perplexityApiKey}),
                    },
                    system: systemPrompt,
                    prompt: userPrompt,
                    maxOutputTokens: 512,
                });
                text = result.text;

            } else {
                throw new Error(`Unsupported provider: ${selectedProvider.providerName}`);
            }

            console.log(`LLM Response: ${text}`);

            const cleanedResponse = cleanBool(text);
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
        decodeDemand,
        addProvider,
        getProvider,
        providers,
    };
};
