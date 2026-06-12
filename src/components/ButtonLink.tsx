import { ArrowRight } from "lucide-react";
import type { AnchorHTMLAttributes, ReactNode } from "react";

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  variant?: "light" | "warm" | "dark";
};

export function ButtonLink({
  children,
  variant = "warm",
  className = "",
  ...props
}: ButtonLinkProps) {
  return (
    <a className={`button-link button-link--${variant} ${className}`.trim()} {...props}>
      <span>{children}</span>
      <ArrowRight aria-hidden="true" />
    </a>
  );
}
