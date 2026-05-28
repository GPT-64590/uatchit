import type { CSSProperties, ElementType, ReactNode } from "react";

interface Props {
  as?: ElementType;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export function MotionIn({ as: Tag = "div", delay = 0, className = "", style, children, ...rest }: Props) {
  const Comp = Tag as ElementType;
  return (
    <Comp
      className={`fade-in ${className}`}
      style={{ ["--d" as string]: `${delay}ms`, ...style }}
      {...rest}
    >
      {children}
    </Comp>
  );
}
