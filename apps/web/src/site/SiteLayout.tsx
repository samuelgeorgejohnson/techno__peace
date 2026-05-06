import type { ReactNode } from "react";

type SiteLayoutProps = {
  title: string;
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

export default function SiteLayout({ title, description, children }: SiteLayoutProps) {
  return (
    <main className="tp-site-shell">
      <header className="tp-site-card tp-site-header">
        <p className="tp-eyebrow">TechnoPeace</p>
        <nav className="tp-site-nav" aria-label="Primary">
          <NavLink href="/" label="Home" />
          <NavLink href="/about" label="About" />
          <NavLink href="/field-recordings" label="Field Recordings" />
          <NavLink href="/essays" label="Essays" />
          <NavLink href="/app/sky" label="Enter Sky Mode" />
        </nav>
      </header>

      <section className="tp-site-card tp-site-hero">
        <h1>{title}</h1>
        <p>{description}</p>
      </section>

      {children}
    </main>
  );
}
