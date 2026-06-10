import type { InsightCategory } from "@/lib/intelligence-engine";

export type InsightValue = string | number | { categoryId: string };

export interface Insight {
  key: string;
  values?: Record<string, InsightValue>;
}

export interface RankedInsight extends Insight {
  category: InsightCategory;
}

export const cat = (categoryId: string): InsightValue => ({ categoryId });

function isCategoryValue(value: InsightValue): value is { categoryId: string } {
  return typeof value === "object" && value !== null && "categoryId" in value;
}

/**
 * Resolves an Insight's values for use with `t.rich()`: category-id sentinels
 * are translated via the `categories` namespace, everything else passes through.
 */
export function resolveInsightValues(
  values: Record<string, InsightValue> | undefined,
  tCategories: (categoryId: string) => string
): Record<string, string | number> {
  if (!values) return {};
  const resolved: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(values)) {
    resolved[key] = isCategoryValue(value) ? tCategories(value.categoryId) : value;
  }
  return resolved;
}
