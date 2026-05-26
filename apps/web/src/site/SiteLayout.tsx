import type { ReactNode } from "react";

type SiteLayoutProps = {
  title: string;
  subtitle?: string;
  description: string;
  children?: ReactNode;
  isHomePage?: boolean;
  showHeroActions?: boolean;
};

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <a className="tp-site-nav-link" href={href}>
      {label}
    </a>
  );
}

const homeNavLinks = [
  { href: "/about", label: "About" },
  { href: "/", label: "Mission" },
  { href: "/essays", label: "Essays" },
  { href: "/field-recordings", label: "Field Recordings" },
  { href: "/about", label: "Contact" },
];

const worldNavLinks = [
  { href: "/about", label: "About" },
  { href: "/", label: "Mission" },
  { href: "/essays", label: "Essays" },
  { href: "/field-recordings", label: "Field Recordings" },
  { href: "/about#contact", label: "Contact" },
  { href: "/app/sky", label: "Enter Sky Mode" },
  { href: "/", label: "Enter World" },
];

export default function SiteLayout({ title, subtitle, description, children, isHomePage = false, showHeroActions = true }: SiteLayoutProps) {
  return (
    <main className={`tp-site-home${isHomePage ? " tp-site-home--landing" : ""}`}>
      <section className="tp-site-hero-stage">
        <div className="tp-site-hero-bg" aria-hidden="true" />
        <header className="tp-site-nav-shell">
          <a className="tp-site-logo-wrap" href="/" aria-label="TechnoPeace home">
            <img src="/assets/logo/technopeace-dove.svg" className="tp-site-logo" alt="" />
          </a>
          <nav className="tp-site-nav" aria-label="Primary">
            {(isHomePage ? homeNavLinks : worldNavLinks).map((link) => (
              <NavLink key={`${link.href}-${link.label}`} href={link.href} label={link.label} />
            ))}
          </nav>
          {isHomePage ? (
            <a className="tp-site-enter-pill" href="/app/sky">
              Enter Sky Mode
            </a>
          ) : <span />}
        </header>

        <div className="tp-site-hero-content">
          <h1>{title}</h1>
          {subtitle ? <p className="tp-site-subtitle">{subtitle}</p> : null}
          <p>{description}</p>
          {showHeroActions ? (
            <div className="tp-site-actions">
              <a className="tp-site-primary" href="/app/sky">Enter Sky Mode</a>
              <a className="tp-site-secondary" href="/field-recordings">Explore the World</a>
            </div>
          ) : null}
        </div>
      </section>

      <section className="tp-site-lower">{children}</section>
    </main>
  );
}
