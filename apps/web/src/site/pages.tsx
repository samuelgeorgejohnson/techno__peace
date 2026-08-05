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
    <SiteLayout
      title="About TechnoPeace"
      subtitle="Play the World."
      description="TechnoPeace is an environmental musical instrument that transforms the conditions of a place into sound."
    >
      <article className="tp-site-text-page">
        <section className="tp-site-text-section tp-site-text-section-intro">
          <p>
            Weather, daylight, clouds, wind, rain, and time are not treated as background information—they become part of
            the instrument itself. Rather than composing against the environment, TechnoPeace composes with it.
          </p>
          <p>
            Every location has a different atmosphere. Every hour changes the character of the instrument. No performance
            is exactly repeatable because the world itself is always changing.
          </p>
          <p>Today, TechnoPeace exists as a browser-based instrument.</p>
          <p>
            Tomorrow, it will become a collection of field recordings, performances, educational tools, research,
            installations, and open-source technology exploring the relationship between sound, ecology, and human
            attention.
          </p>
        </section>

        <section className="tp-site-text-section" aria-labelledby="about-why-heading">
          <h2 id="about-why-heading">Why</h2>
          <p>Modern technology is extraordinarily good at capturing attention.</p>
          <p>Very little of it helps us pay attention.</p>
          <p>TechnoPeace asks a simple question:</p>
          <blockquote>What if technology helped us notice the world instead of replacing it?</blockquote>
          <p>Instead of endless feeds and notifications, the instrument invites listening.</p>
          <p>Instead of escape, it encourages presence.</p>
          <p>Instead of generating sound in isolation, it responds to weather, place, and time.</p>
          <p>The goal is not productivity.</p>
          <p>The goal is awareness.</p>
        </section>

        <section className="tp-site-text-section" aria-labelledby="about-project-heading">
          <h2 id="about-project-heading">The Project</h2>
          <p>
            TechnoPeace combines ideas from music technology, sound art, environmental sensing, acoustics, and interaction
            design.
          </p>
          <p>Current areas of development include:</p>
          <ul>
            <li>Environmental musical instruments</li>
            <li>Weather-driven synthesis</li>
            <li>Field recording</li>
            <li>Soundscape ecology</li>
            <li>Spatial and immersive audio</li>
            <li>Acoustic measurement</li>
            <li>Renewable-powered performance systems</li>
            <li>Open educational resources</li>
            <li>Interactive installations</li>
          </ul>
          <p>Each part supports the same question:</p>
          <blockquote>
            How can technology help people build a more attentive relationship with the world around them?
          </blockquote>
        </section>

        <section className="tp-site-text-section" aria-labelledby="about-looking-forward-heading">
          <h2 id="about-looking-forward-heading">Looking Forward</h2>
          <p>This is version 0.1.0.</p>
          <p>The public beta marks the beginning of a much larger project.</p>
          <p>Future work includes:</p>
          <ul>
            <li>A growing archive of environmental recordings.</li>
            <li>TechnoPeace Field Labs documenting the sonic identity of places.</li>
            <li>Educational resources for music, science, and environmental literacy.</li>
            <li>Live performances driven by real-world conditions.</li>
            <li>Research into resonance, listening, and ecological awareness.</li>
            <li>Open-source tools that allow anyone to explore these ideas.</li>
          </ul>
          <p>TechnoPeace is intended to remain an evolving practice rather than a finished product.</p>
          <p>Every update is another opportunity to listen more carefully.</p>
        </section>

        <p className="tp-site-text-coda">Play the World.</p>
      </article>
    </SiteLayout>
  );
}

export function MissionPage() {
  return (
    <SiteLayout
      title="Mission"
      description="TechnoPeace explores the relationship between people, place, weather, sound, and technology through instruments, field recordings, research, and art."
    >
      <article className="tp-site-text-page">
        <section className="tp-site-text-section tp-site-text-section-intro">
          <h2>Our Mission</h2>
          <p>Technology has changed how we see the world.</p>
          <p>It has also changed how we listen to it.</p>
          <p>
            Our phones know where we are, how fast we’re moving, what the weather is, what music we enjoy, and who we’re
            connected to. Yet despite having more information than any generation before us, many of us spend less time
            paying attention to the places we actually inhabit.
          </p>
          <p>TechnoPeace exists to explore a different relationship with technology.</p>
          <p>One that encourages observation instead of distraction.</p>
          <p>Listening instead of scrolling.</p>
          <p>Curiosity instead of consumption.</p>
          <p>We believe technology should help us notice the world—not replace it.</p>
        </section>

        <section className="tp-site-text-section">
          <h2>The World Is Already Making Music</h2>
          <p>Wind has rhythm.</p>
          <p>Rain has texture.</p>
          <p>Clouds change light.</p>
          <p>Birds mark the seasons.</p>
          <p>Cities develop their own pulse.</p>
          <p>Every place has patterns that exist whether we pay attention to them or not.</p>
          <p>TechnoPeace treats those patterns as creative material.</p>
          <p>Weather becomes part of an instrument.</p>
          <p>Time of day changes harmony.</p>
          <p>Environmental conditions shape sound.</p>
          <p>Instead of composing against nature, we compose with it.</p>
        </section>

        <section className="tp-site-text-section">
          <h2>Peace Is a Practice</h2>
          <p>For us, peace is not simply the absence of conflict.</p>
          <p>It is the practice of paying attention.</p>
          <p>It is slowing down long enough to hear where you are.</p>
          <p>It is recognizing that people, places, and ecosystems are interconnected rather than isolated.</p>
          <p>Technology can either pull us away from that awareness or help us cultivate it.</p>
          <p>We choose the second path.</p>
        </section>

        <section className="tp-site-text-section">
          <h2>Building Better Instruments</h2>
          <p>Throughout history, instruments have expanded human perception.</p>
          <p>The telescope extended sight.</p>
          <p>The microscope revealed hidden worlds.</p>
          <p>The camera preserved moments.</p>
          <p>The synthesizer created entirely new sonic possibilities.</p>
          <p>We believe environmental instruments deserve a place in that lineage.</p>
          <p>Tools that don’t simply produce sound, but respond to the living systems around them.</p>
          <p>Tools that encourage exploration rather than passive consumption.</p>
          <p>Tools that invite collaboration between people and place.</p>
        </section>

        <section className="tp-site-text-section">
          <h2>An Open Practice</h2>
          <p>TechnoPeace is more than a website or a single application.</p>
          <p>It is an ongoing practice of listening, making, measuring, teaching, and sharing.</p>
          <p>That practice includes:</p>
          <ul>
            <li>Environmental musical instruments</li>
            <li>Field recording</li>
            <li>Soundscape ecology</li>
            <li>Acoustics</li>
            <li>Renewable-powered performance</li>
            <li>Arts education</li>
            <li>Open-source software</li>
            <li>Research</li>
            <li>Public performance</li>
          </ul>
          <p>Each project asks the same question:</p>
          <p>How can technology deepen our relationship with the world instead of distracting us from it?</p>
        </section>

        <section className="tp-site-text-section">
          <h2>Looking Ahead</h2>
          <p>We imagine a future where technology helps people become more attentive to their surroundings.</p>
          <p>Where artists collaborate with ecologists.</p>
          <p>Where students learn science through sound.</p>
          <p>Where performances respond to weather instead of ignoring it.</p>
          <p>Where listening becomes an everyday act of care.</p>
          <p>TechnoPeace is one attempt to build toward that future.</p>
          <p>Every recording.</p>
          <p>Every performance.</p>
          <p>Every line of code.</p>
          <p>Every conversation.</p>
          <p>Every update.</p>
          <p>One step closer to playing the world.</p>
        </section>
      </article>
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
