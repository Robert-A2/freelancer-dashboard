import { describe, it, expect } from "vitest";
import { stripGeoNoise } from "../resolve";

describe("stripGeoNoise", () => {
  it("strips a single trailing geography token", () => {
    expect(stripGeoNoise("amazon web services eu")).toBe("amazon web services");
    expect(stripGeoNoise("netflix international")).toBe("netflix");
    expect(stripGeoNoise("spotify global")).toBe("spotify");
  });

  it("strips multiple trailing geography tokens iteratively", () => {
    expect(stripGeoNoise("acme corp global emea")).toBe("acme corp");
  });

  it("returns null when nothing is stripped", () => {
    expect(stripGeoNoise("adobe")).toBeNull();
    expect(stripGeoNoise("starbucks coffee")).toBeNull();
  });

  it("never strips a geography-looking token that isn't trailing", () => {
    // "us" appears as the leading word, not the tail, and the actual trailing
    // word "inc" isn't in GEO_NOISE_TOKENS (legal suffixes are normalizeMatchKey's
    // job, stripped upstream before this ever runs) — nothing to strip, so null.
    expect(stripGeoNoise("us foods inc")).toBeNull();
  });

  it("does not collapse product-distinguishing names — Amazon vs Amazon Prime stay distinct", () => {
    expect(stripGeoNoise("amazon prime")).toBeNull();
    expect(stripGeoNoise("amazon")).toBeNull();
  });

  it("does not solve brand-substitution cases (documented limitation)", () => {
    // "GOOGLE IRELAND" has no shared root with "google ads" to strip down to —
    // stripGeoNoise correctly reduces it only to "google", which is a
    // different key entirely, not a false match.
    expect(stripGeoNoise("google ireland")).toBe("google");
  });

  it("respects the minimum remaining length safeguard", () => {
    // Stripping "us" would leave "us" itself untouched if left with < 2 chars.
    expect(stripGeoNoise("us")).toBeNull();
  });
});
