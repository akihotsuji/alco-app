/**
 * PATCH で `photoIds` を省略したときは現状維持。空配列だけが全解除。
 * `desiredRows ?? []` にすると未指定でも既存写真が全部外れる。
 */
export function photosRemovedByPatch<T extends { id: string }>(
  currentRows: readonly T[],
  desiredRows: readonly T[] | undefined,
): T[] {
  if (desiredRows === undefined) {
    return [];
  }
  const desiredIds = new Set(desiredRows.map((row) => row.id));
  return currentRows.filter((row) => !desiredIds.has(row.id));
}
