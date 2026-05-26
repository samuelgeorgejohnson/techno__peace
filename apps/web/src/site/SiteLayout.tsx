import type { CSSProperties, ReactNode } from "react";
import { useMemo } from "react";
import { getClockSkyFallback, getSkyState } from "../components/getSkyState";
import { useCurrentWeatherSignal } from "../hooks/useCurrentWeatherSignal";

type SiteLayoutProps = {
  title: string;
  subtitle?: string;
  description: string;
  children?: ReactNode;
  atmosphericHome?: boolean;
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
  const fallback = getClockSkyFallback();
  const shouldUseFallback = weather.status !== "live";

  const sky = useMemo(
    () =>
      getSkyState({
        sunAltitudeDeg: shouldUseFallback ? fallback.sunAltitudeDeg : weather.sunAltitudeDeg,
        cloudCover: weather.cloudCover,
        windMps: weather.windMps,
        isDay: shouldUseFallback ? fallback.isDay : weather.isDay,
        moonIllumination: weather.moonPhase <= 0.5 ? weather.moonPhase * 2 : (1 - weather.moonPhase) * 2,
      }),
    [fallback.isDay, fallback.sunAltitudeDeg, shouldUseFallback, weather.cloudCover, weather.isDay, weather.moonPhase, weather.sunAltitudeDeg, weather.windMps],
  );

  const humidity = Math.min(1, Math.max(0, weather.humidityPct / 100));
  const rain = Math.min(1, Math.max(0, (weather.rainMm + weather.showersMm + weather.precipitationMm) / 6));

  return (
    <main
      className="tp-site-home"
      style={
        {
          "--tp-sky-top": sky.topColor,
          "--tp-sky-mid": sky.midColor,
          "--tp-sky-horizon": sky.horizonColor,
          "--tp-cloud-opacity": sky.cloudOpacity.toFixed(3),
          "--tp-cloud-speed": `${Math.max(14, 60 - sky.cloudSpeed)}s`,
          "--tp-sky-brightness": `${0.82 + sky.brightness * 0.3}`,
          "--tp-fog-opacity": (0.08 + humidity * 0.18).toFixed(3),
          "--tp-rain-opacity": (rain * 0.22).toFixed(3),
        } as CSSProperties
      }
    >
      <section className="tp-site-hero-stage">
        <div className="tp-site-hero-bg" aria-hidden="true">
          <div className="tp-site-sky-gradient" />
          <div className="tp-site-sky-diffusion" />
          <div className="tp-site-sky-clouds" />
          <div className="tp-site-sky-fog" />
          <div className="tp-site-sky-rain" />
        </div>
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
            <a className="tp-site-primary" href="/app/sky">Enter Sky Mode</a>
            <a className="tp-site-secondary" href="/field-recordings">Explore the World</a>
          </div>
        </div>
      </section>

      <section className="tp-site-lower">{children}</section>
    </main>
  );
}
