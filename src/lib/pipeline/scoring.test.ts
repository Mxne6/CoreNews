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
  it("matches v3 balanced scoring baseline fixture", () => {
    const fixture = loadFixture();
    const input = {
      ...fixture,
      lastPublishedAt: new Date(fixture.lastPublishedAt),
      now: new Date(fixture.now),
    };

    expect(computeHotScore(input)).toBe(48.82);
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

  it("applies extra stale penalty after 48h without updates", () => {
    const now = new Date("2026-03-03T08:00:00.000Z");
    const at48h = {
      category: "world",
      coverageCount: 3,
      authorityWeightSum: 3.5,
      articleCount: 5,
      lastPublishedAt: new Date("2026-03-01T08:00:00.000Z"),
      now,
    };
    const at72h = {
      ...at48h,
      lastPublishedAt: new Date("2026-02-28T08:00:00.000Z"),
    };

    expect(computeHotScore(at72h)).toBeLessThan(computeHotScore(at48h) * 0.2);
  });

  it("penalizes single-source volume stuffing versus multi-source consensus", () => {
    const now = new Date("2026-03-02T08:00:00.000Z");
    const singleSourceHeavy = {
      category: "world",
      coverageCount: 1,
      authorityWeightSum: 1.2,
      articleCount: 8,
      lastPublishedAt: new Date("2026-03-02T07:30:00.000Z"),
      now,
    };
    const multiSourceConsensus = {
      category: "world",
      coverageCount: 4,
      authorityWeightSum: 4.5,
      articleCount: 8,
      lastPublishedAt: new Date("2026-03-02T07:30:00.000Z"),
      now,
    };

    expect(computeHotScore(multiSourceConsensus)).toBeGreaterThan(
      computeHotScore(singleSourceHeavy),
    );
  });
});

describe("SCORING_VERSION", () => {
  it("is versioned for regression traceability", () => {
    expect(SCORING_VERSION).toBe("v4");
  });
});
