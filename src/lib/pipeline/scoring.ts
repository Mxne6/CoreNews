export const SCORING_VERSION = "v1";

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
  const recencyDecay = Math.exp(-hoursOld / 24);
  const raw =
    input.coverageCount * 35 +
    input.authorityWeightSum * 20 +
    input.articleCount * 5;

  return Number((raw * recencyDecay).toFixed(4));
}
