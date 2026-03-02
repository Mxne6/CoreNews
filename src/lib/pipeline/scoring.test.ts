import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SCORING_VERSION, computeHotScore } from "@/lib/pipeline/scoring";

type Fixture = {
  category: string;
  coverageCount: number;
  authorityWeightSum: number;
  articleCount: number;
  lastPublishedAt: string;
  now: string;
};

function loadFixture(): Fixture {
  const fixturePath = path.join(
    process.cwd(),
    "tests",
    "fixtures",
    "scoring-fixture.json",
  );
  return JSON.parse(fs.readFileSync(fixturePath, "utf8")) as Fixture;
}

describe("computeHotScore", () => {
  it("matches v2 balanced scoring baseline fixture", () => {
    const fixture = loadFixture();
    const input = {
      ...fixture,
      lastPublishedAt: new Date(fixture.lastPublishedAt),
      now: new Date(fixture.now),
    };

    expect(computeHotScore(input)).toBe(105.9868);
  });

  it("is deterministic with fixed input", () => {
    const fixture = loadFixture();
    const input = {
      ...fixture,
      lastPublishedAt: new Date(fixture.lastPublishedAt),
      now: new Date(fixture.now),
    };

    expect(computeHotScore(input)).toBe(computeHotScore(input));
  });

  it("increases score with broader source coverage", () => {
    const base = {
      category: "world",
      coverageCount: 1,
      authorityWeightSum: 1.2,
      articleCount: 2,
      lastPublishedAt: new Date("2026-03-02T04:00:00.000Z"),
      now: new Date("2026-03-02T08:00:00.000Z"),
    };
    const boosted = { ...base, coverageCount: 4, authorityWeightSum: 4.8 };

    expect(computeHotScore(boosted)).toBeGreaterThan(computeHotScore(base));
  });

  it("decreases score for stale events", () => {
    const now = new Date("2026-03-02T08:00:00.000Z");
    const fresh = {
      category: "world",
      coverageCount: 3,
      authorityWeightSum: 3.5,
      articleCount: 5,
      lastPublishedAt: new Date("2026-03-02T07:30:00.000Z"),
      now,
    };
    const stale = { ...fresh, lastPublishedAt: new Date("2026-02-27T07:30:00.000Z") };

    expect(computeHotScore(fresh)).toBeGreaterThan(computeHotScore(stale));
  });
});

describe("SCORING_VERSION", () => {
  it("is versioned for regression traceability", () => {
    expect(SCORING_VERSION).toBe("v2");
  });
});
