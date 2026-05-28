import type { InferredSchema } from "@/lib/infer-schema";

interface Props {
  schema: InferredSchema;
  latestExtracted: Record<string, unknown> | null;
}

function renderValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v.length > 60 ? `"${v.slice(0, 60)}…"` : `"${v}"`;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return `[${v.length}]`;
  return JSON.stringify(v).slice(0, 60);
}

export function SchemaTab({ schema, latestExtracted }: Props) {
  const noSnapshotYet = !latestExtracted || Object.keys(latestExtracted).length === 0;
  return (
    <div>
      <div className="set-section">
        <div className="set-section-h">page type</div>
        <div className="set-row" style={{ gridTemplateColumns: "1fr" }}>
          <div className="set-row-k" style={{ fontFamily: "'Geist Mono', monospace", fontSize: 14 }}>
            {schema.pageType}
          </div>
        </div>
      </div>

      {noSnapshotYet && (
        <div className="empty-soft" style={{ marginBottom: 16 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 0 3px var(--accent-soft)" }} aria-hidden />
          No snapshot yet. Field values will appear after the first successful fetch.
        </div>
      )}

      <div className="set-section">
        <div className="set-section-h">tracked fields · {schema.fields.length}</div>
        {schema.fields.map((f) => {
          const current = latestExtracted ? latestExtracted[f.name] : undefined;
          return (
            <div key={f.name} className="set-row" style={{ alignItems: "flex-start" }}>
              <div>
                <div className="set-row-k" style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13 }}>
                  {f.name}
                </div>
                {f.description && (
                  <div className="set-row-k-sub">{f.description}</div>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="dv" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                  {f.type}
                </div>
                <div style={{ marginTop: 6, fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "var(--text-dim)" }}>
                  {renderValue(current)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
