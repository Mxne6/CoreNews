export const CATEGORY_ORDER = [
  "ai",
  "tech",
  "business",
  "markets",
  "policy",
  "china",
  "us",
  "japan",
  "europe",
  "world",
  "energy",
  "health",
] as const;

export type CategorySlug = (typeof CATEGORY_ORDER)[number];

const CATEGORY_LABELS: Record<string, string> = {
  ai: "AI",
  tech: "科技",
  business: "商业",
  markets: "市场",
  policy: "政策",
  china: "中国",
  us: "美国",
  japan: "日本",
  europe: "欧洲",
  world: "国际",
  energy: "能源",
  health: "健康",
};

export function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category.toUpperCase();
}

export function getCategoryHref(category: string): string {
  return `/category/${category}`;
}

export function isKnownCategory(slug: string): slug is CategorySlug {
  return CATEGORY_ORDER.includes(slug as CategorySlug);
}

export function getHeatLevel(score?: number): "high" | "medium" | "low" {
  if (typeof score !== "number") {
    return "low";
  }
  if (score >= 85) {
    return "high";
  }
  if (score >= 70) {
    return "medium";
  }
  return "low";
}

