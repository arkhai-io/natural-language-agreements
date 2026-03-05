---
name: nla-arbitrate
description: Manually arbitrate NLA escrows as an alternative to the automated oracle. Use when the user wants to act as an AI arbiter themselves - fetching pending escrows that name the agent as oracle, evaluating demands against fulfillments, and submitting on-chain arbitration decisions via the alkahest TypeScript SDK.
metadata:
  author: arkhai
  version: "1.0"
compatibility: Requires bun or node. Requires alkahest-ts and nla packages. Requires a funded Ethereum wallet whose address matches the oracle specified in escrows.
allowed-tools: Bash Read Write
---

# Manual NLA Arbitration

Act as an AI arbiter for NLA escrows, bypassing the automated oracle listener. Fetch escrow data, evaluate demands against fulfillments, and submit arbitration decisions on-chain.

## When to use this

- The user wants to manually review and decide on escrow fulfillments instead of relying on the automated oracle
- The user is the oracle (their wallet address was specified as the oracle when escrows were created)
- The automated oracle is not running, or the user wants more control over decisions

## Step-by-step instructions

### 1. Determine the oracle address

The user's wallet address must be the oracle specified in the escrow. Check:

```bash
nla wallet:show
```

### 2. Fetch pending arbitration requests

Write and run a TypeScript script to find escrows pending arbitration. The script uses the alkahest-ts SDK to query on-chain state.

```typescript
import { createWalletClient, createPublicClient, http, publicActions, fromHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { makeClient } from "alkahest-ts";
import { contracts } from "alkahest-ts";
import { makeLLMClient } from "nla";

// Setup - adjust these for the user's environment
const deployment = JSON.parse(require("fs").readFileSync("<deployment-file>", "utf-8"));
// Deployment files are at: cli/deployments/anvil.json, sepolia.json, base-sepolia.json, mainnet.json
// Or detect automatically using nla's utils

const chain = /* appropriate viem chain */;
const account = privateKeyToAccount("<private-key>" as `0x${string}`);
const walletClient = createWalletClient({
  account,
  chain,
  transport: http(deployment.rpcUrl),
}).extend(publicActions);

const client = makeClient(walletClient as any, deployment.addresses);
const llmClient = makeLLMClient([]);

const publicClient = createPublicClient({
  chain,
  transport: http(deployment.rpcUrl),
});

// Query all Attested events from EAS
const filter = await publicClient.createContractEventFilter({
  address: deployment.addresses.eas as `0x${string}`,
  abi: contracts.IEAS.abi.abi,
  eventName: "Attested",
  fromBlock: 0n,
});
const events = await publicClient.getFilterLogs({ filter });

// For each event, check if it's an arbitration request targeting our oracle address
// Arbitration requests reference a fulfillment UID which in turn references an escrow UID
```

### 3. Decode escrow and fulfillment data

For a specific escrow UID:

```typescript
// Get the escrow attestation
const escrow = await client.getAttestation(escrowUid);
const escrowData = client.erc20.escrow.nonTierable.decodeObligation(escrow.data);

// The demand is double-encoded:
// Layer 1: TrustedOracleArbiter demand (contains oracle address + inner data)
const trustedOracleDemand = client.arbiters.general.trustedOracle.decodeDemand(escrowData.demand);
// trustedOracleDemand.oracle - the oracle address (should match user's address)
// trustedOracleDemand.data - the inner NLA demand data

// Layer 2: NLA LLM demand (contains provider, model, prompt, demand text)
const nlaDemand = llmClient.decodeDemand(trustedOracleDemand.data);
// nlaDemand.demand - the natural language demand text
// nlaDemand.arbitrationProvider - e.g. "OpenAI"
// nlaDemand.arbitrationModel - e.g. "gpt-4o-mini"
// nlaDemand.arbitrationPrompt - the prompt template with {{demand}} and {{obligation}} placeholders

// Get fulfillment data (fulfillments use CommitRevealObligation)
const fulfillment = await client.getAttestation(fulfillmentUid);
const commitRevealData = client.commitReveal.decode(fulfillment.data);
const fulfillmentText = fromHex(commitRevealData.payload, "string");
```

### 4. Evaluate the fulfillment

Present the decoded data to the user (or evaluate it yourself as the AI agent):

- **Demand**: The natural language condition
- **Fulfillment**: The submitted text
- **Arbitration prompt**: The template that guides evaluation
- **Model/Provider**: What was originally specified (informational for manual arbitration)

Apply the arbitration prompt logic: substitute `{{demand}}` and `{{obligation}}` with actual values, then determine if the fulfillment satisfies the demand. The result is a boolean: `true` (approved) or `false` (rejected).

### 5. Submit the arbitration decision

Use the `arbitrateMany` callback or submit directly:

```typescript
// Option A: Use arbitrateMany with a custom callback (handles polling and submission)
const { unwatch } = await client.arbiters.general.trustedOracle.arbitrateMany(
  async ({ attestation, demand }) => {
    // decode and evaluate as shown above
    // return true or false
    return decision;
  },
  {
    onAfterArbitrate: async (result) => {
      console.log(`Decision UID: ${result.attestation.uid}`);
      console.log(`Result: ${result.decision ? "APPROVED" : "REJECTED"}`);
    },
    pollingInterval: 1000,
  }
);

// Option B: For one-shot arbitration, use arbitrateMany with a short polling interval
// and call unwatch() after the decision is submitted
```

### 6. Verify the decision

```bash
nla escrow:status --escrow-uid <escrow_uid>
```

Confirm the arbitration decision appears in the status output.

## Key details

- The user's wallet address MUST match the oracle address in the escrow's demand - otherwise the on-chain arbiter contract will reject the decision
- Demands are double-encoded: TrustedOracleArbiter wraps NLA LLM demand data
- Fulfillments use CommitRevealObligation - decode with `client.commitReveal.decode()`, then `fromHex(payload, "string")`
- The `arbitrateMany` method handles both polling for pending requests and submitting decisions on-chain
- Each arbitration decision is recorded as an on-chain attestation (permanent and immutable)
- Deployment files with contract addresses are at `cli/deployments/<network>.json`
- Use `nla network` to check which network is currently active

## Alternative: use nla escrow:status for read-only inspection

If the user just wants to inspect escrow state without submitting decisions:

```bash
# View escrow details, fulfillments, and existing arbitration results
nla escrow:status --escrow-uid <uid>
```

This does not require being the oracle.
