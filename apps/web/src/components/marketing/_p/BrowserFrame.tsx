import type { CSSProperties, ReactNode } from "react";

interface Tab { title: string; fav?: string }
interface Props {
  url?: string;
  tabs?: Tab[];
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}

const DEFAULT_TABS: Tab[] = [
  { title: "Pricing · Claude", fav: "linear-gradient(135deg, #d97757, #c2410c)" },
  { title: "Linear",            fav: "linear-gradient(135deg, #5E6AD2, #BBC3FF)" },
];

export function BrowserFrame({ url = "claude.com/pricing", tabs = DEFAULT_TABS, children, style, className = "" }: Props) {
  return (
    <div className={`browser ${className}`} style={style}>
      <div className="browser-bar">
        <div className="browser-traffic">
          <i style={{ background: "#FF5F57" }} />
          <i style={{ background: "#FEBC2E" }} />
          <i style={{ background: "#28C840" }} />
        </div>
        <div className="browser-tabs">
          {tabs.map((tab, i) => (
            <div key={i} className={`tab ${i === 0 ? "active" : ""}`}>
              <span className="tab-fav" style={tab.fav ? { background: tab.fav } : undefined} />
              <span className="tab-title">{tab.title}</span>
            </div>
          ))}
        </div>
        <div className="browser-actions">
          <i className="dot" /><i className="dot" /><i className="dot" />
        </div>
      </div>
      <div className="browser-url">
        <span className="mono">https://{url}</span>
      </div>
      <div className="browser-body">{children}</div>
    </div>
  );
}
