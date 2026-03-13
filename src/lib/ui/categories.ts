export const CATEGORY_ORDER = [
  "domestic",
  "international",
  "current-affairs",
  "society",
  "finance",
  "tech",
  "sports",
  "entertainment",
  "culture-education",
  "lifestyle",
] as const;

export type CategorySlug = (typeof CATEGORY_ORDER)[number];

const CATEGORY_LABELS: Record<string, string> = {
  domestic: "国内",
  international: "国际",
  "current-affairs": "时政",
  society: "社会",
  finance: "财经",
  tech: "科技",
  sports: "体育",
  entertainment: "娱乐",
  "culture-education": "文化教育",
  lifestyle: "生活",
  // Legacy compatibility for historical payloads.
  ai: "科技",
  business: "财经",
  markets: "财经",
  policy: "时政",
  china: "国内",
  us: "国际",
  japan: "国际",
  europe: "国际",
  world: "国际",
  energy: "财经",
  health: "生活",
};

const LEGACY_CATEGORY_TO_FLAT: Record<string, CategorySlug> = {
  ai: "tech",
  tech: "tech",
  business: "finance",
  markets: "finance",
  policy: "current-affairs",
  china: "domestic",
  us: "international",
  japan: "international",
  europe: "international",
  world: "international",
  energy: "finance",
  health: "lifestyle",
};

export function normalizeCategory(category: string): CategorySlug {
  const key = category.trim().toLowerCase();
  if (CATEGORY_ORDER.includes(key as CategorySlug)) {
    return key as CategorySlug;
  }
  return LEGACY_CATEGORY_TO_FLAT[key] ?? "international";
}

export function getCategoryLabel(category: string): string {
  const normalized = normalizeCategory(category);
  return CATEGORY_LABELS[normalized] ?? CATEGORY_LABELS[category] ?? category.toUpperCase();
}

export function getCategoryHref(category: string): string {
  return `/category/${normalizeCategory(category)}`;
}

export function isKnownCategory(slug: string): slug is CategorySlug {
  const key = slug.trim().toLowerCase();
  return CATEGORY_ORDER.includes(key as CategorySlug) || key in LEGACY_CATEGORY_TO_FLAT;
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
