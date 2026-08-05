import { useMemo, type CSSProperties } from "react";
import { useCurrentWeatherSignal } from "../hooks/useCurrentWeatherSignal";
import SiteLayout from "./SiteLayout";

const overviewCards = [
  {
    title: "World",
    description: "Public essays, field notes, and a living archive of atmosphere.",
    href: "/about",
    ariaLabel: "Open the TechnoPeace world overview",
  },
  {
    title: "Sky",
    description: "An interactive instrument tuned by time, cloud, sun, and moon.",
    href: "/sky",
    ariaLabel: "Enter Sky Mode",
  },
  {
    title: "Archive",
    description: "Recorded environments and sonic traces from specific places.",
    href: "/field-recordings",
    ariaLabel: "Open the field recordings archive",
  },
  {
    title: "Contact",
    description: "Collaborators, context, and pathways into the work.",
    href: "/contact",
    ariaLabel: "Open contact information",
  },
];

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function useHomeAtmosphereStyle() {
  const weather = useCurrentWeatherSignal();

  return useMemo(() => {
    const cloud = clamp01(weather.cloudCover);
    const daylight = weather.isDay ? 1 : 0;
    const sun = clamp01((weather.sunAltitudeDeg + 10) / 80);
    const humidity = clamp01(weather.humidityPct / 100);
    const wind = clamp01(weather.windMps / 18);
    const currentRainEvidence = Math.max(
      Number.isFinite(weather.rainMm) ? weather.rainMm : 0,
      Number.isFinite(weather.showersMm) ? weather.showersMm : 0,
      Number.isFinite(weather.precipitationMm) ? weather.precipitationMm : 0,
    );
    const rain = clamp01(currentRainEvidence / 5);
    const night = 1 - Math.max(daylight, sun * 0.72);

    return {
      "--tp-home-daylight": daylight.toFixed(3),
      "--tp-home-sun": sun.toFixed(3),
      "--tp-home-cloud": cloud.toFixed(3),
      "--tp-home-humidity": humidity.toFixed(3),
      "--tp-home-wind": wind.toFixed(3),
      "--tp-home-rain": rain.toFixed(3),
      "--tp-home-night": night.toFixed(3),
    } as CSSProperties;
  }, [
    weather.cloudCover,
    weather.humidityPct,
    weather.isDay,
    weather.precipitationMm,
    weather.rainMm,
    weather.showersMm,
    weather.sunAltitudeDeg,
    weather.windMps,
  ]);
}

function OverviewCards() {
  return (
    <div className="tp-site-overview-grid">
      {overviewCards.map((card) => (
        <a key={card.title} className="tp-site-overview-card" href={card.href} aria-label={card.ariaLabel}>
          <article>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
          </article>
        </a>
      ))}
    </div>
  );
}

export function SiteHomePage() {
  const atmosphereStyle = useHomeAtmosphereStyle();

  return (
    <SiteLayout
      atmosphereStyle={atmosphereStyle}
      title="TechnoPeace"
      subtitle="Calm systems for peace, weather, and attention."
      description="A cinematic world site and a gateway into Sky Mode, where live local conditions gently shape light, haze, and sound."
      showHeroActions
    >
      <OverviewCards />
    </SiteLayout>
  );
}

export function AboutPage() {
  return (
    <SiteLayout title="About / Contact" description="Placeholder for project story, collaborators, and contact pathways.">
      <OverviewCards />
    </SiteLayout>
  );
}

export function MissionPage() {
  return (
    <SiteLayout
      title="Mission"
      description="TechnoPeace explores the relationship between people, place, weather, sound, and technology through instruments, field recordings, research, and art."
    >
      <OverviewCards />
    </SiteLayout>
  );
}

export function ContactPage() {
  return (
    <SiteLayout
      title="Contact"
      description="Get in touch regarding collaborations, performances, research, education, or field recording projects."
    >
      <OverviewCards />
    </SiteLayout>
  );
}

export function FieldRecordingsPage() {
  return (
    <SiteLayout title="Field Recordings" description="Placeholder archive route for future recordings and releases.">
      <OverviewCards />
    </SiteLayout>
  );
}

export function EssaysPage() {
  return (
    <SiteLayout title="Essays / Manifesto" description="Placeholder route for writing, theory, and worldbuilding texts.">
      <OverviewCards />
    </SiteLayout>
  );
}

export function ChaosPlaceholderPage() {
  return (
    <SiteLayout
      title="Chaos Mode (Future)"
      description="Chaos Mode route is reserved for a future playable system while Sky Mode remains the active instrument."
    >
      <section className="tp-site-actions">
        <a className="tp-site-primary" href="/sky">Launch Sky Mode</a>
      </section>
    </SiteLayout>
  );
}
