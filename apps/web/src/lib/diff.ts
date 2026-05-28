export type FieldChange =
  | { kind: "changed"; before: unknown; after: unknown }
  | { kind: "added"; after: unknown }
  | { kind: "removed"; before: unknown };

export type Diff = Record<string, FieldChange>;

export function diffExtracted(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown>
): Diff {
  const out: Diff = {};
  const beforeMap = before ?? {};
  const allKeys = new Set([...Object.keys(beforeMap), ...Object.keys(after)]);

  for (const k of allKeys) {
    const b = beforeMap[k];
    const a = after[k];
    const inBefore = k in beforeMap && b !== null && b !== undefined;
    const inAfter = k in after && a !== null && a !== undefined;

    if (!inBefore && inAfter) {
      out[k] = { kind: "added", after: a };
    } else if (inBefore && !inAfter) {
      out[k] = { kind: "removed", before: b };
    } else if (inBefore && inAfter && !valuesEqual(b, a)) {
      out[k] = { kind: "changed", before: b, after: a };
    }
  }
  return out;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a === "object" && a !== null && b !== null) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

export function isMaterialDiff(diff: Diff): boolean {
  return Object.keys(diff).length > 0;
}
