import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { encodeAbiParameters, parseAbiParameters } from "viem";

import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

import {
    setupTestEnvironment,
    type TestContext,
} from "alkahest-ts";
import { makeLLMClient } from "..";

let testContext: TestContext;
let charlieClient: ReturnType<typeof testContext.charlie.client.extend<{ llm: ReturnType<typeof makeLLMClient> }>>;

beforeAll(async () => {
    testContext = await setupTestEnvironment();
    charlieClient = testContext.charlie.client.extend((client) => ({
        llm: makeLLMClient([]),
    }));
    charlieClient.llm.addProvider({
        providerName: "OpenAI",
        apiKey: process.env.OPENAI_API_KEY,
    });
});

beforeEach(async () => {
    if (testContext.anvilInitState) {
        await testContext.testClient.loadState({
            state: testContext.anvilInitState,
        });
    }
});

afterAll(async () => {
    // Clean up
});


test("listenAndArbitrate Natural Language", async () => {

    const arbiter = testContext.addresses.trustedOracleArbiter;
    const demand = testContext.alice.client.arbiters.general.trustedOracle.encode({
        oracle: testContext.bob.address,
        data: charlieClient.llm.encodeDemand({
            arbitrationProvider: "OpenAI",
            arbitrationModel: "gpt-4.1",
            arbitrationPrompt: `Evaluate the fulfillment against the demand and decide whether the demand was validly fulfilled

Demand: {{demand}}

Fulfillment: {{obligation}}`,
            demand: "The sky is blue"
        })
    });

    const { attested: escrow } =
        await testContext.alice.client.erc20.permitAndBuyWithErc20(
            {
                address: testContext.mockAddresses.erc20A,
                value: 10n,
            },
            { arbiter, demand },
            0n,
        );

    const obligationAbi = parseAbiParameters("(string item)");
    const { decisions, unwatch } =
        await testContext.bob.client.oracle.listenAndArbitrate(
            async (attestation) => {
                console.log("arbitrating");
                const obligation = testContext.bob.client.extractObligationData(
                    obligationAbi,
                    attestation,
                );
                const [, demand] = await testContext.bob.client.getEscrowAndDemand(
                    charlieClient.llm.LLMAbi,
                    attestation,
                );

                const result = await charlieClient.llm.arbitrate(demand[0], obligation[0].item);
                console.log("response", result);
                return result;
            },
            {
                onAfterArbitrate: async (decision) => {
                    const obligation = testContext.bob.client.extractObligationData(
                        obligationAbi,
                        decision.attestation,
                    );
                    expect(decision.attestation.uid).toEqual(fulfillment.uid);
                    expect(obligation[0].item).toEqual("The sky appears blue today");
                    expect(decision.decision).toBe(true);
                },
                pollingInterval: 50,
            },
        );

    const { attested: fulfillment } =
        await testContext.bob.client.stringObligation.doObligation(
            "The sky appears blue today",
            escrow.uid,
        );

    await testContext.bob.client.oracle.requestArbitration(
        fulfillment.uid,
        testContext.bob.address,
    );

    //Should call WaitForArbitration()
    await Bun.sleep(5000);

    const collectionHash = await testContext.bob.client.erc20.collectEscrow(
        escrow.uid,
        fulfillment.uid,
    );

    expect(collectionHash).toBeTruthy();

    unwatch();
}, { timeout: 20000 });
