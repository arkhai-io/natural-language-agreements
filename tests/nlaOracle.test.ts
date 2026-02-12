import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { toHex, keccak256, fromHex } from "viem";

import {
    setupTestEnvironment,
    type TestContext,
} from "alkahest-ts";
import { makeLLMClient } from "..";
import { ProviderName } from "../nla";

let testContext: TestContext;
let charlieClient: ReturnType<typeof testContext.charlie.client.extend<{ llm: ReturnType<typeof makeLLMClient> }>>;

beforeAll(async () => {
    testContext = await setupTestEnvironment();
    charlieClient = testContext.charlie.client.extend((client) => ({
        llm: makeLLMClient([]),
    }));
    charlieClient.llm.addProvider({
        providerName: ProviderName.OpenAI,
        apiKey: process.env.OPENAI_API_KEY,
    });
    charlieClient.llm.addProvider({
        providerName: ProviderName.OpenRouter,
        apiKey: process.env.OPENROUTER_API_KEY,
    });
    charlieClient.llm.addProvider({
        providerName: ProviderName.Anthropic,
        apiKey: process.env.ANTHROPIC_API_KEY,
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
    const demand = testContext.alice.client.arbiters.general.trustedOracle.encodeDemand({
        oracle: testContext.bob.address,
        data: charlieClient.llm.encodeDemand({
            arbitrationProvider: ProviderName.OpenRouter,
            arbitrationModel: "openai/gpt-4o",
            arbitrationPrompt: `Evaluate the fulfillment against the demand and decide whether the demand was validly fulfilled

Demand: {{demand}}

Fulfillment: {{obligation}}`,
            demand: "The sky is blue"
        })
    });

    const { attested: escrow } =
        await testContext.alice.client.erc20.escrow.nonTierable.permitAndCreate(
            {
                address: testContext.mockAddresses.erc20A,
                value: 10n,
            },
            { arbiter, demand },
            0n,
        );

    const { decisions, unwatch } =
        await testContext.bob.client.arbiters.general.trustedOracle.arbitrateMany(
            async ({ attestation, demand }) => {
                console.log("Arbitrating ", attestation, demand);
                const commitRevealData = testContext.bob.client.commitReveal.decode(attestation.data);
                const obligationItem = fromHex(commitRevealData.payload, 'string');
                console.log("Obligation:", obligationItem);
                const trustedOracleDemandData = testContext.bob.client.arbiters.general.trustedOracle.decodeDemand(demand);
                const nlaDemandData = charlieClient.llm.decodeDemand(trustedOracleDemandData.data);

                const result = await charlieClient.llm.arbitrate(nlaDemandData, obligationItem);
                console.log("response", result);
                return result;
            },
            {
                onAfterArbitrate: async (decision) => {
                    const commitRevealData = testContext.bob.client.commitReveal.decode(decision.attestation.data);
                    const obligationItem = fromHex(commitRevealData.payload, 'string');
                    expect(decision.attestation.uid).toEqual(fulfillment.uid);
                    expect(obligationItem).toEqual("The sky appears blue today");
                    expect(decision.decision).toBe(true);
                },
                pollingInterval: 50,
            },
        );

    const schema = keccak256(toHex("{item:string}"));
    const salt = keccak256(toHex(crypto.randomUUID()));
    const payload = toHex("The sky appears blue today");
    const obligationData = { payload, salt, schema };

    // Commit-reveal flow: commit, wait a block, reveal, reclaim bond
    const commitment = await testContext.bob.client.commitReveal.computeCommitment(
        escrow.uid,
        testContext.bob.address,
        obligationData,
    );
    await testContext.bob.client.commitReveal.commit(commitment);
    await testContext.testClient.mine({ blocks: 1 });

    const { attested: fulfillment } =
        await testContext.bob.client.commitReveal.doObligation(
            obligationData,
            escrow.uid,
        );

    await testContext.bob.client.commitReveal.reclaimBond(fulfillment.uid);

    await testContext.bob.client.arbiters.general.trustedOracle.requestArbitration(
        fulfillment.uid,
        testContext.bob.address,
        demand
    );

    //Should call WaitForArbitration()
    await Bun.sleep(5000);

    const collectionHash = await testContext.bob.client.erc20.escrow.nonTierable.collect(
        escrow.uid,
        fulfillment.uid,
    );

    expect(collectionHash).toBeTruthy();

    unwatch();
}, { timeout: 20000 });

test("full flow: alice escrow -> bob fulfill -> charlie arbitrate -> bob collect", async () => {
    // 1. Alice deposits an escrow with a demand, designating Charlie as oracle
    const arbiter = testContext.addresses.trustedOracleArbiter;
    const demand = testContext.alice.client.arbiters.general.trustedOracle.encodeDemand({
        oracle: testContext.charlie.address,
        data: charlieClient.llm.encodeDemand({
            arbitrationProvider: ProviderName.OpenRouter,
            arbitrationModel: "openai/gpt-4o",
            arbitrationPrompt: `Evaluate the fulfillment against the demand and decide whether the demand was validly fulfilled

Demand: {{demand}}

Fulfillment: {{obligation}}`,
            demand: "Write a haiku about the ocean"
        })
    });

    const escrowAmount = 100n;
    const { attested: escrow } =
        await testContext.alice.client.erc20.escrow.nonTierable.permitAndCreate(
            {
                address: testContext.mockAddresses.erc20A,
                value: escrowAmount,
            },
            { arbiter, demand },
            0n,
        );

    expect(escrow.uid).toBeTruthy();
    console.log(`✅ Alice created escrow: ${escrow.uid}`);

    // 3. Charlie starts listening as oracle (set up before Bob fulfills)
    let arbitrationResolved: () => void;
    const arbitrationDone = new Promise<void>((resolve) => {
        arbitrationResolved = resolve;
    });

    const { unwatch } =
        await charlieClient.arbiters.general.trustedOracle.arbitrateMany(
            async ({ attestation, demand: demandData }) => {
                console.log(`📨 Charlie received arbitration request for: ${attestation.uid}`);
                const commitRevealData = charlieClient.commitReveal.decode(attestation.data);
                const obligationItem = fromHex(commitRevealData.payload, 'string');
                console.log(`   Obligation text: "${obligationItem}"`);

                const trustedOracleDemandData = charlieClient.arbiters.general.trustedOracle.decodeDemand(demandData);
                const nlaDemandData = charlieClient.llm.decodeDemand(trustedOracleDemandData.data);
                console.log(`   Demand: "${nlaDemandData.demand}"`);

                const result = await charlieClient.llm.arbitrate(nlaDemandData, obligationItem);
                console.log(`   ✨ Arbitration result: ${result}`);
                return result;
            },
            {
                onAfterArbitrate: async (decision) => {
                    console.log(`📝 Charlie recorded decision: ${decision.decision}`);
                    arbitrationResolved();
                },
                pollingInterval: 50,
            },
        );

    // 2. Bob fulfills the escrow using commit-reveal
    const schema = keccak256(toHex("{item:string}"));
    const salt = keccak256(toHex(crypto.randomUUID()));
    const fulfillmentText = "Waves crash on shore\nSalt and foam kiss weathered rocks\nThe tide breathes in, out";
    const payload = toHex(fulfillmentText);
    const obligationData = { payload, salt, schema };

    // Commit phase
    const commitment = await testContext.bob.client.commitReveal.computeCommitment(
        escrow.uid,
        testContext.bob.address,
        obligationData,
    );
    await testContext.bob.client.commitReveal.commit(commitment);
    await testContext.testClient.mine({ blocks: 1 });

    // Reveal phase
    const { attested: fulfillment } =
        await testContext.bob.client.commitReveal.doObligation(
            obligationData,
            escrow.uid,
        );
    expect(fulfillment.uid).toBeTruthy();
    console.log(`✅ Bob created fulfillment: ${fulfillment.uid}`);

    // Reclaim bond
    await testContext.bob.client.commitReveal.reclaimBond(fulfillment.uid);
    console.log(`✅ Bob reclaimed bond`);

    // Bob requests arbitration from Charlie
    await testContext.bob.client.arbiters.general.trustedOracle.requestArbitration(
        fulfillment.uid,
        testContext.charlie.address,
        demand,
    );
    console.log(`📤 Bob requested arbitration from Charlie`);

    // Wait for Charlie to arbitrate
    await arbitrationDone;
    console.log(`✅ Arbitration complete`);

    // 4. Bob collects the escrow reward
    const bobBalanceBefore = await testContext.testClient.getErc20Balance(
        { address: testContext.mockAddresses.erc20A },
        testContext.bob.address,
    );

    const collectionHash = await testContext.bob.client.erc20.escrow.nonTierable.collect(
        escrow.uid,
        fulfillment.uid,
    );
    expect(collectionHash).toBeTruthy();

    const bobBalanceAfter = await testContext.testClient.getErc20Balance(
        { address: testContext.mockAddresses.erc20A },
        testContext.bob.address,
    );
    expect(bobBalanceAfter - bobBalanceBefore).toEqual(escrowAmount);
    console.log(`✅ Bob collected ${escrowAmount} tokens from escrow`);

    unwatch();
}, { timeout: 30000 });
