/**
 * Duplicate detection for AI-drafted questions.
 *
 * Pure functions so the behaviour is unit-testable and identical wherever it
 * runs. Mirrors the trigram approach used by the bulk importer: normalise the
 * text, compare trigram sets with the Sørensen–Dice coefficient.
 */

export const DUPLICATE_THRESHOLD = 0.6;

/** Lowercases, strips punctuation and collapses whitespace. */
export function normalizeStem(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function trigrams(text: string): Set<string> {
  const padded = `  ${normalizeStem(text)} `;
  const set = new Set<string>();
  for (let i = 0; i < padded.length - 2; i += 1) set.add(padded.slice(i, i + 3));
  return set;
}

/** Sørensen–Dice similarity in the range 0-1. */
export function similarity(a: string, b: string): number {
  const left = trigrams(a);
  const right = trigrams(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const gram of left) if (right.has(gram)) shared += 1;
  return (2 * shared) / (left.size + right.size);
}

export type ExistingQuestion = { id: string; stem: string };
export type DuplicateHit = { questionId: string; stem: string; similarity: number };

/** Ranked near-duplicates of one draft stem within the existing bank. */
export function findDuplicates(
  draftStem: string,
  existing: ExistingQuestion[],
  threshold = DUPLICATE_THRESHOLD,
  limit = 3,
): DuplicateHit[] {
  return existing
    .map((row) => ({
      questionId: row.id,
      stem: row.stem,
      similarity: Number(similarity(draftStem, row.stem).toFixed(3)),
    }))
    .filter((hit) => hit.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}