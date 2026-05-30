"use client";
import { motion, type Variants } from "framer-motion";
import { I } from "./Icons";

// A detected field is either a value change (old → new) or one or more
// additions. Modeling it as a union keeps illegal mixes unrepresentable.
export type DiffFieldData =
  | { kind: "change"; keyName: string; from: string; to: string }
  | { kind: "add"; keyName: string; adds: string[] };

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.08 } },
};

const rowIn: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

/** The diff rows, revealed one-by-one the first time they scroll into view. */
export function DiffFieldsReveal({ fields }: { fields: DiffFieldData[] }) {
  return (
    <motion.div
      className="diff-fields"
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.5 }}
    >
      {fields.map((f, i) => (
        <motion.div key={i} className="diff-field" variants={rowIn}>
          <div className="diff-field-key mono">{f.keyName}</div>
          {f.kind === "change" ? (
            <div className="diff-field-vals">
              <span className="dv dv-rm mono">{f.from}</span>
              <I.ArrowRight width={12} height={12} style={{ color: "var(--text-faint)" }} />
              <span className="dv dv-add mono">{f.to}</span>
            </div>
          ) : (
            <div className="diff-field-vals diff-field-vals-stack">
              {f.adds.map((a, j) => (
                <span key={j} className="dv dv-add mono">+ {a}</span>
              ))}
            </div>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}
