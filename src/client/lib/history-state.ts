function readProperty(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  if (!(key in value)) {
    return undefined;
  }
  return Reflect.get(value, key);
}

/** React Router が history.state に載せる idx。ディープリンク直開きは 0。 */
export function historyIdx(state: unknown): number | undefined {
  const idx = readProperty(state, "idx");
  return typeof idx === "number" ? idx : undefined;
}

export function historyHasFlag(state: unknown, flag: string): boolean {
  return readProperty(state, flag) === true;
}
