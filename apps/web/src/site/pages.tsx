import SiteLayout from "./SiteLayout";

function OverviewCards() {
  return (
    <div className="tp-site-overview-grid">
      <article className="tp-site-overview-card">
        <h2>Our Mission</h2>
        <p>Technology in service of peace and presence.</p>
      </article>
      <article className="tp-site-overview-card">
        <h2>Essays & Reflections</h2>
        <p>Thoughts on listening, culture, and our future.</p>
      </article>
      <article className="tp-site-overview-card">
        <h2>Field Recordings</h2>
        <p>Real places. Real sounds. Shared freely.</p>
      </article>
      <article className="tp-site-overview-card">
        <h2>About TechnoPeace</h2>
        <p>Our story, our team, our journey.</p>
      </article>
    </div>
  );
}

export function SiteHomePage() {
  return (
    <SiteLayout
      title="TechnoPeace"
      subtitle="A world of listening. A story of our time."
      description="An environmental sound instrument and resonance practice for tuning attention."
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
        <a className="tp-site-primary" href="/app/sky">Launch Sky Mode</a>
      </section>
    </SiteLayout>
  );
}
