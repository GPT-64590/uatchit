import { useEffect, useRef } from "react";
import { I } from "./Icons";

export type AttachKind = "page" | "selection";

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (kind: AttachKind) => void;
  hasSelection: boolean;
}

export function AttachMenu({ open, onClose, onPick, hasSelection }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="attach-menu" ref={ref}>
      <button
        type="button"
        className="attach-row"
        onClick={() => { onPick("page"); onClose(); }}
      >
        <I.Layers width={12} height={12} />
        <div>
          <div className="attach-row-label">Attach page content</div>
          <div className="attach-row-sub">Sends the active tab as context</div>
        </div>
      </button>
      <button
        type="button"
        className="attach-row"
        disabled={!hasSelection}
        onClick={() => { onPick("selection"); onClose(); }}
      >
        <I.Paperclip width={12} height={12} />
        <div>
          <div className="attach-row-label">Attach selection</div>
          <div className="attach-row-sub">
            {hasSelection ? "Sends what's selected on the page" : "Highlight text on the page first"}
          </div>
        </div>
      </button>
    </div>
  );
}
