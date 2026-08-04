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

const siteNavLinks = [
  { href: "/about", label: "About" },
  { href: "/projects", label: "Projects" },
  { href: "/contact", label: "Contact" },
  { href: "/app", label: "Enter Sky Mode" },
];

export default function SiteLayout({ title, subtitle, description, children, isHomePage = false, showHeroActions = true }: SiteLayoutProps) {
  return (
    <main className={`tp-site-home${isHomePage ? " tp-site-home--landing" : " tp-site-home--subpage"}`}>
      <section className="tp-site-hero-stage">
        <div className="tp-site-hero-bg" aria-hidden="true" />
        <header className="tp-site-nav-shell">
          <a className="tp-site-logo-wrap" href="/" aria-label="TechnoPeace home">
            <img src="/assets/logo/technopeace-dove.svg" className="tp-site-logo" alt="" />
          </a>
          <nav className="tp-site-nav" aria-label="Primary">
            {siteNavLinks.map((link) => (
              <NavLink key={`${link.href}-${link.label}`} href={link.href} label={link.label} />
            ))}
          </nav>
          <span />
        </header>

        <div className="tp-site-hero-content">
          <h1>{title}</h1>
          {subtitle ? <p className="tp-site-subtitle">{subtitle}</p> : null}
          <p>{description}</p>
          {showHeroActions ? (
            <div className="tp-site-actions">
              <a className="tp-site-primary" href="/app/sky">Enter Sky Mode</a>
              <a className="tp-site-secondary" href="/about">Explore the World</a>
            </div>
          ) : null}
        </div>
      </section>

      <section className="tp-site-lower">{children}</section>
    </main>
  );
}
