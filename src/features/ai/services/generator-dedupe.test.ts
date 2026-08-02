import { describe, expect, it } from "vitest";

import { findDuplicates, normalizeStem, similarity } from "./generator-dedupe";

describe("normalizeStem", () => {
  it("lowercases, strips punctuation and collapses whitespace", () => {
    expect(normalizeStem("  What is   Conditional Access?! ")).toBe("what is conditional access");
  });
});

describe("similarity", () => {
  it("scores identical text as 1", () => {
    expect(similarity("Enable MFA for admins", "enable mfa for admins!")).toBe(1);
  });

  it("scores unrelated text low", () => {
    expect(similarity("Configure Conditional Access", "Rotate a storage account key")).toBeLessThan(
      0.3,
    );
  });

  it("scores reworded near-duplicates high", () => {
    expect(
      similarity(
        "Which Conditional Access control requires multifactor authentication?",
        "Which Conditional Access control requires multi factor authentication?",
      ),
    ).toBeGreaterThan(0.8);
  });
});

describe("findDuplicates", () => {
  const bank = [
    { id: "a", stem: "Which Conditional Access grant control requires MFA?" },
    { id: "b", stem: "How do you assign a Privileged Identity Management role?" },
  ];

  it("flags a near-duplicate above the threshold", () => {
    const hits = findDuplicates("Which Conditional Access grant control requires MFA", bank);
    expect(hits[0]?.questionId).toBe("a");
    expect(hits[0]?.similarity).toBeGreaterThan(0.9);
  });

  it("returns nothing for an original question", () => {
    expect(findDuplicates("Describe token lifetime policies in Entra ID", bank)).toEqual([]);
  });

  it("ranks the strongest match first and respects the limit", () => {
    const hits = findDuplicates("Which Conditional Access grant control requires MFA?", [
      ...bank,
      { id: "c", stem: "Which Conditional Access grant control requires MFA today?" },
    ]);
    expect(hits).toHaveLength(2);
    expect(hits[0]!.similarity).toBeGreaterThanOrEqual(hits[1]!.similarity);
  });
});