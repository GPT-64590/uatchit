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

// Structural equality, key-order-INSENSITIVE for objects (the LLM may emit the
// same fields in a different order between two extractions — that's not a change)
// but order-SENSITIVE for arrays (a reorder can be a real ranking move worth
// alerting on). Replaces JSON.stringify equality, which was key-order-sensitive.
function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => valuesEqual(x, (b as unknown[])[i]));
  }
  if (typeof a === "object") {
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const ak = Object.keys(ao);
    if (ak.length !== Object.keys(bo).length) return false;
    return ak.every((k) => Object.prototype.hasOwnProperty.call(bo, k) && valuesEqual(ao[k], bo[k]));
  }
  return false;
}

export function isMaterialDiff(diff: Diff): boolean {
  return Object.keys(diff).length > 0;
}
