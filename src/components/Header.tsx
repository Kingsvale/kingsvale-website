import { SiteText } from "./SiteText";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import type { NavLink } from "../lib/contentTypes";
import { Logo } from "./Logo";

type HeaderProps = {
  brandName: string;
  brandSuffix: string;
  navLinks: NavLink[];
};

export function Header({ brandName, brandSuffix, navLinks }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const currentPath = window.location.pathname;

  return (
    <header className="site-header" data-testid="site-header" data-menu-open={open}>
      <div className="site-header__inner">
        <Logo brandName={brandName} brandSuffix={brandSuffix} />
        <button
          className="nav-toggle"
          type="button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        <nav className="primary-nav" data-open={open} aria-label="Primary navigation">
          {navLinks.map((link, index) => (
            <a
              key={`${link.href}-${link.label}`}
              href={link.href}
              aria-current={isActiveLink(link.href, currentPath) ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <SiteText field={`navLinks.${index}.label`}>{link.label}</SiteText>
            </a>
          ))}
          <a
            href="/plot-lookup"
            aria-current={currentPath === "/plot-lookup" ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            <SiteText copy="header_lookup">Lookup</SiteText></a>
        </nav>
      </div>
    </header>
  );
}

function isActiveLink(href: string, currentPath: string) {
  if (href === "/") {
    return currentPath === "/";
  }

  return currentPath === href || currentPath.startsWith(`${href}/`);
}
