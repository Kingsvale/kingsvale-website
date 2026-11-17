import { SiteText, SiteEditingContext } from "./SiteText";
import { Menu, X } from "lucide-react";
import { useContext, useEffect, useRef, useState } from "react";
import type { NavLink } from "../lib/contentTypes";
import { Logo } from "./Logo";

type HeaderProps = {
  brandName: string;
  brandSuffix: string;
  navLinks: NavLink[];
};

export function Header({ brandName, brandSuffix, navLinks }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const keyboardOpen = useRef(false);
  const currentPath = useContext(SiteEditingContext)?.route ?? (typeof window === "undefined" ? "/" : window.location.pathname);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.setTimeout(() => { if (keyboardOpen.current && document.activeElement === toggle.current) header.current?.querySelector<HTMLAnchorElement>("nav a")?.focus(); }, 200);
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); toggle.current?.focus(); }
      if (event.key !== "Tab") return;
      const controls = [...header.current?.querySelectorAll<HTMLElement>("button, nav a") ?? []];
      const index = controls.indexOf(document.activeElement as HTMLElement);
      if ((event.shiftKey && index <= 0) || (!event.shiftKey && index === controls.length - 1)) { event.preventDefault(); controls[event.shiftKey ? controls.length - 1 : 0]?.focus(); }
    }
    const outside = (event: PointerEvent) => { if (!header.current?.contains(event.target as Node)) setOpen(false); };
    const desktop = window.matchMedia("(min-width: 861px)");
    const resize = () => { if (desktop.matches) setOpen(false); };
    document.addEventListener("keydown", keydown); document.addEventListener("pointerdown", outside); desktop.addEventListener("change", resize);
    return () => { clearTimeout(focusFrame); document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", keydown); document.removeEventListener("pointerdown", outside); desktop.removeEventListener("change", resize); };
  }, [open]);

  return (
    <header ref={header} className="site-header" data-testid="site-header" data-menu-open={open}>
      <a className="skip-link" href="#main-content" onClick={() => { setOpen(false); document.getElementById("main-content")?.focus(); }}>Skip to content</a>
      <div className="site-header__inner">
        <Logo brandName={brandName} brandSuffix={brandSuffix} />
        <button
          className="nav-toggle"
          ref={toggle}
          type="button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="primary-navigation"
          onClick={event => { keyboardOpen.current = event.detail === 0; setOpen((current) => !current); }}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        <nav className="primary-nav" id="primary-navigation" data-open={open} aria-label="Primary navigation">
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
