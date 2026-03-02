export const SCORING_VERSION = "v2";

export type HotScoreInput = {
  category: string;
  coverageCount: number;
  authorityWeightSum: number;
  articleCount: number;
  lastPublishedAt: Date;
  now: Date;
};

export function computeHotScore(input: HotScoreInput): number {
  const hoursOld = Math.max(
    0,
    (input.now.getTime() - input.lastPublishedAt.getTime()) / 3_600_000,
  );
  const coverage = Math.max(0, input.coverageCount);
  const authority = Math.max(0, input.authorityWeightSum);
  const articles = Math.max(0, input.articleCount);

  const base =
    50 * Math.log1p(coverage) +
    30 * Math.log1p(authority) +
    20 * Math.log1p(articles);
  const recencyDecay = Math.exp(-hoursOld / 18);
  const consensusBoost = 1 + Math.min(0.2, Math.max(0, coverage - 1) * 0.05);

  return Number((base * recencyDecay * consensusBoost).toFixed(4));
}
