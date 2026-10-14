import { expect, test } from "bun:test";
import { assessModelAttribution } from "../src/lib/leaderboard";
import type { GitHubTextSource } from "../src/lib/leaderboard-types";
import type { ProjectRunReceipt } from "../src/lib/run-receipts";

// Producer-derived regression for #681: the body is the exact footer the
// slopdotcash contribute skill publishes, not a hand-built marker.
const receipt = {
  schemaVersion: "2",
  runId: "run_0123456789ABCDEFGHJKMNPQRS",
  projectId: "slopdotcash",
  repositoryId: "SlopDotCash/slopdotcash",
  startedAt: "2026-10-12T00:00:00.000Z",
  completedAt: "2026-10-12T00:01:00.000Z",
  provider: "OpenAI",
  model: "gpt-5",
  client: "codex",
  skillRevision:
    "SlopDotCash/slopdotcash@36ff30c07fb70efef753015cfd92cee8d07043a8:skills/contribute-to-slopdotcash",
  skillSha256: "a".repeat(64),
  policyAcknowledgement: {
    policyRevision: "2026-10-11.1",
    licenseSha256:
      "3c50e19c2a6022364f5cef932e4e5cdbddc91087e52ae8d8614b48a04fee40a5",
    inboundTermsSha256:
      "69302e234b8c5dececde858d7ba5736a2471b18875ca8fdb0adb099a3cebb962",
    prizeRulesSha256: null,
    acknowledgedAt: "2026-10-12T00:00:30.000Z",
  },
  usage: {
    source: "none",
    confidence: "unavailable",
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    totalTokens: 0,
    costMicroUsd: "0",
    sessionCount: 0,
  },
  trajectorySha256: null,
  traceUpload: null,
  signatureAlgorithm: "ed25519",
  devicePublicKey: "a".repeat(43),
  deviceKeyId: "b".repeat(64),
  deviceSignature: "c".repeat(86),
} satisfies ProjectRunReceipt;

// The skill script is untyped JavaScript; load it with a narrow signature so
// the test exercises the exact producer the skill ships.
const producerPath =
  "../skills/contribute-to-slopdotcash/scripts/run-receipt.mjs";
const { footer } = (await import(producerPath)) as {
  footer: (receipt: ProjectRunReceipt, lane: string) => string;
};

function assess(body: string) {
  const source: GitHubTextSource = {
    id: "PR_footer",
    artifactId: "PR_footer",
    kind: "body",
    body,
    url: "https://github.com/SlopDotCash/slopdotcash/pull/1",
    createdAt: "2026-10-13T00:00:00.000Z",
    updatedAt: "2026-10-13T00:00:00.000Z",
    author: {
      id: "U_test",
      login: "contributor",
      avatarUrl: "",
      url: "https://github.com/contributor",
      kind: "User",
    },
  };
  return assessModelAttribution([source], { requireEverySource: true });
}

test("footer(receipt) publishes a signed run under the slop v1 token", () => {
  const body = footer(receipt, "contributor");
  expect(body).toContain("<!-- slop-contribution-attribution:v1 ");
  expect(body).toContain('"run":{');
});

test("a producer footer(receipt) keeps its verified run", () => {
  const result = assess(`Summary.\n\n${footer(receipt, "contributor")}`);
  expect(result.invalidMarkers).toEqual([]);
  expect(result.coverage.status).toBe("complete");
  expect(result.coverage.invalidSourceCount).toBe(0);
  const declaration = result.declarations.find(
    (entry) => entry.format === "machine-marker",
  );
  expect(declaration?.skillRevision).toBe(receipt.skillRevision);
  expect(declaration?.run?.runId).toBe(receipt.runId);
  expect(declaration?.run?.projectId).toBe("slopdotcash");
});

test("a tampered producer footer is rejected instead of downgraded", () => {
  const body = footer(receipt, "contributor").replace(
    receipt.runId,
    "not-a-run-id",
  );
  const result = assess(body);
  expect(result.coverage.status).toBe("partial");
  expect(result.invalidMarkers).toHaveLength(1);
  expect(
    result.declarations.some(
      (entry) => entry.run !== null && entry.run !== undefined,
    ),
  ).toBe(false);
});
