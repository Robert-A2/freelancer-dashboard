import { describe, it, expect } from "vitest";
import { extractMerchantCandidate } from "../extract";

describe("extractMerchantCandidate — reference-code vs. real-word suffix stripping", () => {
  it("still strips genuine alphanumeric reference codes (contain a digit)", () => {
    expect(extractMerchantCandidate("ACME SUPPLIES 8H2K9LXQ2T", -20)?.normalizedKey).toBe("acme supplies");
    expect(extractMerchantCandidate("WIDGET CO REF88213AB", -20)?.normalizedKey).toBe("widget");
  });

  it("does NOT strip a real all-caps English word with no digits", () => {
    // Regression test: "INTERNATIONAL" (13 letters, all-caps, no digit) was
    // previously matched by the reference-code pattern and silently deleted.
    expect(extractMerchantCandidate("SPOTIFY INTERNATIONAL", -10)?.normalizedKey).toBe("spotify international");
    expect(extractMerchantCandidate("NETFLIX WORLDWIDE", -15)?.normalizedKey).toBe("netflix worldwide");
  });

  it("expense-only — returns null for non-negative amounts", () => {
    expect(extractMerchantCandidate("SPOTIFY INTERNATIONAL", 10)).toBeNull();
  });
});
