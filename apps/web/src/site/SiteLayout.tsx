import type { ReactNode } from "react";

type SiteLayoutProps = {
  title: string;
  subtitle?: string;
  description: string;
  children?: ReactNode;
};

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <a className="tp-site-nav-link" href={href}>
      {label}
    </a>
  );
}

export default function SiteLayout({ title, subtitle, description, children }: SiteLayoutProps) {
  return (
    <main className="tp-site-home">
      <section className="tp-site-hero-stage">
        <div className="tp-site-hero-bg" aria-hidden="true" />
        <header className="tp-site-nav-shell">
          <a className="tp-site-logo-wrap" href="/" aria-label="TechnoPeace home">
            <img src="/assets/logo/technopeace-dove.svg" className="tp-site-logo" alt="" />
          </a>
          <nav className="tp-site-nav" aria-label="Primary">
            <NavLink href="/about" label="About" />
            <NavLink href="/" label="Mission" />
            <NavLink href="/essays" label="Essays" />
            <NavLink href="/field-recordings" label="Field Recordings" />
            <NavLink href="/about" label="Contact" />
          </nav>
          <a className="tp-site-enter-pill" href="/app/sky">
            Enter Sky Mode
          </a>
        </header>

        <div className="tp-site-hero-content">
          <h1>{title}</h1>
          {subtitle ? <p className="tp-site-subtitle">{subtitle}</p> : null}
          <p>{description}</p>
          <div className="tp-site-actions">
            <a className="tp-site-primary" href="/app/sky">Descend into Sky Mode</a>
            <a className="tp-site-secondary" href="/field-recordings">Listen to Field Notes</a>
          </div>
        </div>
      </section>

      <section className="tp-site-lower">{children}</section>
    </main>
  );
}
