import SiteLayout from "./SiteLayout";

function OverviewCards() {
  return (
    <div className="tp-site-overview-grid">
      <article className="tp-site-overview-card">
        <h2>Our Mission</h2>
        <p>Technology in service of peace, place, and careful attention.</p>
      </article>
      <article className="tp-site-overview-card">
        <h2>Essays & Reflections</h2>
        <p>Writing on listening, culture, climate, and shared futures.</p>
      </article>
      <article className="tp-site-overview-card">
        <h2>Field Recordings</h2>
        <p>Field-captured atmospheres from real places, shared openly.</p>
      </article>
      <article className="tp-site-overview-card">
        <h2>About TechnoPeace</h2>
        <p>Background, collaborators, and ways to reach the project.</p>
      </article>
    </div>
  );
}

export function SiteHomePage() {
  return (
    <SiteLayout
      title="TechnoPeace"
      subtitle="Listening as practice, atmosphere as instrument."
      description="A responsive environmental instrument for tuning attention to weather, place, and human signal."
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
