import type { CSSProperties, ReactNode } from "react";
import { useCurrentWeatherSignal } from "../hooks/useCurrentWeatherSignal";
import { getClockSkyFallback, getSkyState } from "../components/getSkyState";

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
  const weather = useCurrentWeatherSignal();
  const clockFallback = getClockSkyFallback();
  const moonIllumination = weather.moonPhase <= 0.5 ? weather.moonPhase * 2 : (1 - weather.moonPhase) * 2;
  const sky = getSkyState({
    sunAltitudeDeg: Number.isFinite(weather.sunAltitudeDeg) ? weather.sunAltitudeDeg : clockFallback.sunAltitudeDeg,
    cloudCover: weather.cloudCover,
    windMps: weather.windMps,
    isDay: weather.status === "live" ? weather.isDay : clockFallback.isDay,
    moonIllumination,
  });
  const rainEvidence = Math.max(weather.rainMm || 0, weather.showersMm || 0, weather.precipitationMm || 0);
  const visualStyle = {
    "--tp-sky-top": sky.topColor,
    "--tp-sky-mid": sky.midColor,
    "--tp-sky-horizon": sky.horizonColor,
    "--tp-sky-cloud-opacity": String(Math.min(0.86, sky.cloudOpacity + weather.humidityPct / 260)),
    "--tp-sky-cloud-speed": `${Math.max(38, 110 - sky.cloudSpeed * 2.8)}s`,
    "--tp-sky-haze": String(Math.min(0.62, weather.humidityPct / 170 + rainEvidence / 18)),
    "--tp-sky-stars": String(Math.max(0, (1 - sky.dayness) * (1 - weather.cloudCover * 0.75))),
    "--tp-sky-light-x": `${Math.max(12, Math.min(88, 50 + weather.sunAltitudeDeg * 0.42))}%`,
    "--tp-sky-light-y": `${Math.max(8, Math.min(72, 60 - weather.sunAltitudeDeg * 0.52))}%`,
    "--tp-sky-vignette": String(0.44 + (1 - sky.brightness) * 0.36),
  } as CSSProperties;

  return (
    <main className="tp-site-home" style={visualStyle}>
      <section className="tp-site-hero-stage">
        <div className="tp-site-hero-bg" aria-hidden="true" />
        <header className="tp-site-nav-shell">
          <a className="tp-site-logo-wrap" href="/" aria-label="TechnoPeace home">
            <img src="/assets/logo/technopeace-dove.svg" className="tp-site-logo" alt="" />
          </a>
          <nav className="tp-site-nav" aria-label="Primary">
            <NavLink href="/about" label="About" />
            <NavLink href="/mission" label="Mission" />
            <NavLink href="/essays" label="Essays" />
            <NavLink href="/field-recordings" label="Field Recordings" />
            <NavLink href="/contact" label="Contact" />
          </nav>
          <a className="tp-site-enter-pill" href="/app/sky" aria-label="Enter Sky Mode instrument">
            Enter Sky Mode
          </a>
        </header>

        <div className="tp-site-hero-content">
          <h1>{title}</h1>
          {subtitle ? <p className="tp-site-subtitle">{subtitle}</p> : null}
          <p>{description}</p>
          <div className="tp-site-actions">
            <a className="tp-site-primary" href="/app/sky">Enter Sky Mode</a>
            <a className="tp-site-secondary" href="/field-recordings">Explore the World</a>
          </div>
        </div>
      </section>

      <section className="tp-site-lower">{children}</section>
    </main>
  );
}
