import { describe, it, expect } from "vitest";
import { buildMerchantIndex } from "../merchant-db";
import { categorizeTransaction } from "../engine";
import type { DbMerchantRow } from "../types";

describe("buildMerchantIndex", () => {
  it("returns an empty index for an empty input", () => {
    const index = buildMerchantIndex([]);
    expect(index).toEqual({
      expenseHigh: [],
      expenseMedium: [],
      incomePatterns: [],
      savingsKeywords: [],
      transferKeywords: [],
    });
  });

  it("buckets an income row (with aliases) into incomePatterns", () => {
    const rows: DbMerchantRow[] = [
      { keyword: "deel", transactionType: "income", category: "freelance platform", confidence: "high", aliases: ["deel.com"] },
    ];
    expect(buildMerchantIndex(rows).incomePatterns).toEqual([
      { keywords: ["deel", "deel.com"], subcategory: "freelance platform", confidence: "high" },
    ]);
  });

  it("buckets a high-confidence expense row into expenseHigh", () => {
    const rows: DbMerchantRow[] = [
      { keyword: "examplecorp", transactionType: "expense", category: "software", confidence: "high", aliases: [] },
    ];
    const index = buildMerchantIndex(rows);
    expect(index.expenseHigh).toEqual([{ keyword: "examplecorp", category: "software", confidence: "high" }]);
    expect(index.expenseMedium).toEqual([]);
  });

  it("buckets a medium-confidence expense row into expenseMedium", () => {
    const rows: DbMerchantRow[] = [
      { keyword: "generic fee", transactionType: "expense", category: "banking fees", confidence: "medium", aliases: [] },
    ];
    expect(buildMerchantIndex(rows).expenseMedium).toEqual([
      { keyword: "generic fee", category: "banking fees", confidence: "medium" },
    ]);
  });

  it("treats a 'low' confidence expense row as a medium-confidence keyword match", () => {
    const rows: DbMerchantRow[] = [
      { keyword: "vague term", transactionType: "expense", category: "personal spending", confidence: "low", aliases: [] },
    ];
    const index = buildMerchantIndex(rows);
    expect(index.expenseHigh).toEqual([]);
    expect(index.expenseMedium).toEqual([{ keyword: "vague term", category: "personal spending", confidence: "medium" }]);
  });

  it("expands each alias of an expense row into its own entry", () => {
    const rows: DbMerchantRow[] = [
      { keyword: "hellosign", transactionType: "expense", category: "software", confidence: "high", aliases: ["dropbox sign"] },
    ];
    expect(buildMerchantIndex(rows).expenseHigh).toEqual([
      { keyword: "hellosign", category: "software", confidence: "high" },
      { keyword: "dropbox sign", category: "software", confidence: "high" },
    ]);
  });

  it("buckets a savings row (with aliases) into savingsKeywords", () => {
    const rows: DbMerchantRow[] = [
      { keyword: "examplebank savings pot", transactionType: "savings", category: "savings", confidence: "high", aliases: ["examplebank pocket"] },
    ];
    expect(buildMerchantIndex(rows).savingsKeywords).toEqual(["examplebank savings pot", "examplebank pocket"]);
  });

  it("buckets a transfer row into transferKeywords", () => {
    const rows: DbMerchantRow[] = [
      { keyword: "examplepay internal move", transactionType: "transfer", category: "transfer", confidence: "high", aliases: [] },
    ];
    expect(buildMerchantIndex(rows).transferKeywords).toEqual(["examplepay internal move"]);
  });

  it("strips diacritics and lowercases keywords/aliases", () => {
    const rows: DbMerchantRow[] = [
      { keyword: "Café Crédit", transactionType: "expense", category: "food", confidence: "high", aliases: ["Épargne Plus"] },
    ];
    expect(buildMerchantIndex(rows).expenseHigh.map((e) => e.keyword)).toEqual(["cafe credit", "epargne plus"]);
  });
});

describe("categorizeTransaction + merchantIndex integration", () => {
  it("matches a DB-only high-confidence expense keyword that the static packs don't recognize", () => {
    const index = buildMerchantIndex([
      { keyword: "examplecorp", transactionType: "expense", category: "software", confidence: "high", aliases: [] },
    ]);

    const withoutIndex = categorizeTransaction("EXAMPLECORP MONTHLY", -10);
    expect(withoutIndex.category).toBe("uncategorized");

    const withIndex = categorizeTransaction("EXAMPLECORP MONTHLY", -10, undefined, undefined, index);
    expect(withIndex).toMatchObject({ transactionType: "expense", category: "software", confidence: "high" });
  });

  it("matches a DB-only income pattern", () => {
    const index = buildMerchantIndex([
      { keyword: "examplepay", transactionType: "income", category: "freelance platform", confidence: "high", aliases: [] },
    ]);
    const result = categorizeTransaction("EXAMPLEPAY PAYOUT", 500, undefined, undefined, index);
    expect(result).toMatchObject({ transactionType: "income", category: "freelance platform" });
  });

  it("matches a DB-only savings keyword ahead of generic transfer detection", () => {
    const index = buildMerchantIndex([
      { keyword: "examplebank savings pot", transactionType: "savings", category: "savings", confidence: "high", aliases: [] },
    ]);

    const withoutIndex = categorizeTransaction("Transfer to ExampleBank Savings Pot", -50);
    expect(withoutIndex.transactionType).not.toBe("savings");

    const withIndex = categorizeTransaction("Transfer to ExampleBank Savings Pot", -50, undefined, undefined, index);
    expect(withIndex.transactionType).toBe("savings");
  });

  it("matches a DB-only transfer keyword regardless of amount sign", () => {
    const index = buildMerchantIndex([
      { keyword: "examplepay internal move", transactionType: "transfer", category: "transfer", confidence: "high", aliases: [] },
    ]);
    const result = categorizeTransaction("ExamplePay internal move", 100, undefined, undefined, index);
    expect(result.transactionType).toBe("transfer");
  });

  it("an empty merchantIndex reproduces the result of passing undefined (regression safety)", () => {
    const emptyIndex = buildMerchantIndex([]);
    const withUndefined = categorizeTransaction("Tesco Express", -25, undefined, "Robert Arthur");
    const withEmptyIndex = categorizeTransaction("Tesco Express", -25, undefined, "Robert Arthur", emptyIndex);
    expect(withEmptyIndex).toEqual(withUndefined);
  });
});
