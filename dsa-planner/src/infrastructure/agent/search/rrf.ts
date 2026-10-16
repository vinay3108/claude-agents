const DEFAULT_K = 60;

/** Merge ranked identifier lists with reciprocal rank fusion. */
export function reciprocalRankFusion(
  lists: readonly (readonly string[])[],
  k = DEFAULT_K,
): string[] {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((id, rank) =>
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank + 1)),
    );
  }
  return [...scores.entries()]
    .sort(
      ([leftId, leftScore], [rightId, rightScore]) =>
        rightScore - leftScore || leftId.localeCompare(rightId),
    )
    .map(([id]) => id);
}
