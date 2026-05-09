import SiteLayout from "./SiteLayout";

function OverviewCards() {
  return (
    <div className="tp-site-overview-grid">
      <article className="tp-site-overview-card">
        <h2>Listening Practice</h2>
        <p>TechnoPeace begins by tuning attention to place, weather, and shared atmosphere.</p>
      </article>
      <article className="tp-site-overview-card">
        <h2>Essays & Reflections</h2>
        <p>Notes on resonance, ecology, and contemplative technology.</p>
      </article>
      <article className="tp-site-overview-card">
        <h2>Field Recordings</h2>
        <p>Weather, motion, birds, traffic, and quiet: each place as living score.</p>
      </article>
      <article className="tp-site-overview-card">
        <h2>About TechnoPeace</h2>
        <p>Part observatory, part instrument, part ritual for returning to presence.</p>
      </article>
    </div>
  );
}

export function SiteHomePage() {
  return (
    <SiteLayout
      title="TechnoPeace"
      subtitle="An environmental listening instrument."
      description="It transforms atmosphere, weather, motion, and time into a living sonic field."
    >
      <OverviewCards />
    </SiteLayout>
  );
}

export function AboutPage() {
  return (
    <SiteLayout title="About / Contact" description="A small studio for atmospheric listening, research, and collaborative reflection.">
      <OverviewCards />
    </SiteLayout>
  );
}

export function FieldRecordingsPage() {
  return (
    <SiteLayout title="Field Recordings" description="A growing archive of places heard as changing climates, rhythms, and resonant habitats.">
      <OverviewCards />
    </SiteLayout>
  );
}

export function EssaysPage() {
  return (
    <SiteLayout title="Essays / Manifesto" description="Short writings on attention, sound ecologies, and how technology can remain humane.">
      <OverviewCards />
    </SiteLayout>
  );
}

export function ChaosPlaceholderPage() {
  return (
    <SiteLayout
      title="Chaos Mode"
      description="A denser pulse field for moments when the sky needs friction. Enter, shape, and return."
    >
      <section className="tp-site-actions">
        <a className="tp-site-primary" href="/app/sky">Launch Sky Mode</a>
      </section>
    </SiteLayout>
  );
}
