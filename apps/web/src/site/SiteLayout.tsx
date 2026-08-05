import type { CSSProperties, ReactNode } from "react";

type SiteLayoutProps = {
  title: string;
  subtitle?: string;
  description: string;
  children?: ReactNode;
  showHeroActions?: boolean;
  atmosphereStyle?: CSSProperties;
};

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <a className="tp-site-nav-link" href={href}>
      {label}
    </a>
  );
}

export default function SiteLayout({
  title,
  subtitle,
  description,
  children,
  showHeroActions = false,
  atmosphereStyle,
}: SiteLayoutProps) {
  return (
    <main className="tp-site-home" style={atmosphereStyle}>
      <section className="tp-site-hero-stage">
        <div className="tp-site-hero-bg" aria-hidden="true" />
        <div className="tp-site-atmosphere" aria-hidden="true" />
        <header className="tp-site-nav-shell">
          <a className="tp-site-logo-wrap" href="/" aria-label="TechnoPeace home">
            <img src="/assets/logo/technopeace-dove.svg" className="tp-site-logo" alt="" />
          </a>
          <nav className="tp-site-nav" aria-label="Primary">
            <NavLink href="/about" label="About" />
            <NavLink href="/mission" label="Mission" />
            <NavLink href="/field-recordings" label="Field Recordings" />
            <NavLink href="/contact" label="Contact" />
          </nav>
        </header>

        <div className="tp-site-hero-content">
          <h1>{title}</h1>
          {subtitle ? <p className="tp-site-subtitle">{subtitle}</p> : null}
          <p>{description}</p>
          {showHeroActions ? (
            <div className="tp-site-actions">
              <a className="tp-site-primary" href="/sky">Enter Sky Mode</a>
              <a className="tp-site-secondary" href="/about">Explore the World</a>
            </div>
          ) : null}
        </div>
      </section>

      <section className="tp-site-lower">{children}</section>
    </main>
  );
}
