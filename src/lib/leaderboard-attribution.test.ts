import { describe, expect, test } from "bun:test";
import { assessModelAttribution } from "./leaderboard";
import type { GitHubTextSource } from "./leaderboard-types";

const actor: NonNullable<GitHubTextSource["author"]> = {
  id: "U_attribution",
  login: "contributor",
  avatarUrl: "https://avatars.githubusercontent.com/u/1",
  url: "https://github.com/contributor",
  kind: "User",
};

const disclosed = {
  provider: "SpaceXAI",
  model: "Grok-4.7",
  client: "cursor-cloud-agent",
  skill_revision:
    "N/A - ordinary GitHub contribution without optional run evidence",
};

function source(id: string, markerName: string): GitHubTextSource {
  const body = [
    "Made via @slopdotcash",
    `AI provider/model: ${disclosed.provider} / ${disclosed.model}`,
    `Client / agent tooling: ${disclosed.client}`,
    `Contribution skill revision: ${disclosed.skill_revision}`,
    "Attribution status: self-reported",
    "\u2014 [contributor]",
    `<!-- ${markerName} ${JSON.stringify(disclosed)} -->`,
  ].join("\n");
  return {
    id,
    artifactId: id,
    kind: "body",
    body,
    url: `https://github.com/SlopDotCash/slopdotcash/pull/1#${id}`,
    createdAt: "2026-10-13T00:00:00.000Z",
    updatedAt: "2026-10-13T00:00:00.000Z",
    author: actor,
  };
}

describe("ordinary attribution markers", () => {
  test("accepts a slop v1 disclosure as a machine marker", () => {
    const assessment = assessModelAttribution([
      source("PR_slop", "slop-contribution-attribution:v1"),
    ]);

    expect(assessment.invalidMarkers).toEqual([]);
    expect(assessment.coverage).toEqual({
      status: "complete",
      eligibleSourceCount: 1,
      validSourceCount: 1,
      missingSourceCount: 0,
      invalidSourceCount: 0,
      humanOnlySourceCount: 0,
    });
    expect(assessment.declarations).toEqual([
      expect.objectContaining({
        format: "machine-marker",
        provider: disclosed.provider,
        model: disclosed.model,
        client: disclosed.client,
        skillRevision: disclosed.skill_revision,
        run: null,
      }),
    ]);
  });

  test("keeps an eliza v1 disclosure on the disclosure parser", () => {
    const assessment = assessModelAttribution([
      source("PR_eliza_v1", "elizaos-contribution-attribution:v1"),
    ]);

    expect(assessment.invalidMarkers).toEqual([]);
    expect(assessment.coverage.status).toBe("complete");
    expect(assessment.declarations[0]?.format).toBe("machine-marker");
    expect(assessment.declarations[0]?.run).toBeNull();
  });

  test("still requires a run object for an eliza v2 marker", () => {
    const assessment = assessModelAttribution([
      source("PR_eliza_v2", "elizaos-contribution-attribution:v2"),
    ]);

    expect(assessment.invalidMarkers).toEqual([
      expect.objectContaining({
        sourceId: "PR_eliza_v2",
        reason: "run marker has unexpected or missing fields",
      }),
    ]);
    expect(
      assessment.declarations.some(
        (declaration) => declaration.format === "machine-marker",
      ),
    ).toBe(false);
  });
});
