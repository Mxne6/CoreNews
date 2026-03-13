export const SCORING_VERSION = "v4";

export type HotScoreInput = {
  category: string;
  coverageCount: number;
  authorityWeightSum: number;
  articleCount: number;
  lastPublishedAt: Date;
  now: Date;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function computeHotScore(input: HotScoreInput): number {
  const hoursOld = Math.max(
    0,
    (input.now.getTime() - input.lastPublishedAt.getTime()) / 3_600_000,
  );
  const coverage = Math.max(0, input.coverageCount);
  const authority = Math.max(0, input.authorityWeightSum);
  const articles = Math.max(0, input.articleCount);
  const authorityPerSource = authority / Math.max(1, coverage);

  // Saturating terms avoid runaway scores from brute-force article volume.
  const coverageNorm = 1 - Math.exp(-coverage / 2.5);
  const authorityNorm = clamp(authorityPerSource / 1.6, 0, 1);
  const volumeNorm = clamp(Math.log1p(articles) / Math.log1p(12), 0, 1);

  const base = 100 * (0.48 * coverageNorm + 0.32 * authorityNorm + 0.2 * volumeNorm);
  const recencyDecay = Math.exp(-hoursOld / 20);
  const freshnessBoost = hoursOld <= 6 ? 1.08 : 1;
  const sourceDiversity = clamp(coverage / Math.max(1, articles), 0, 1);
  const diversityBoost = 0.86 + sourceDiversity * 0.28;
  const singleSourceVolumePenalty = coverage <= 1 && articles >= 4 ? 0.78 : 1;

  // Events without new reports for >48h get an additional exponential penalty.
  const staleHours = Math.max(0, hoursOld - 48);
  const stalePenalty = staleHours > 0 ? Math.exp(-staleHours / 14) : 1;

  return Number(
    (
      base *
      recencyDecay *
      freshnessBoost *
      diversityBoost *
      singleSourceVolumePenalty *
      stalePenalty
    ).toFixed(4),
  );
}
