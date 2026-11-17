import { type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

export function Reveal({ children, className = "" }: RevealProps) {
  // Keep the established layout without hiding content until a scroll observer
  // fires. This also leaves the server-rendered page fully readable without JS.
  return <div className={className}>{children}</div>;
}
