import SiteLayout from "./SiteLayout";

export function SiteHomePage() {
  return (
    <SiteLayout
      title="World, signal, and instrument."
      description="TechnoPeace is an environmental sound instrument, a resonance practice, and a field-recording world built for tuning attention."
    >
      <section className="tp-site-grid">
        <article className="tp-site-card">
          <h2>Mission</h2>
          <p>Build a living practice around sound, place, and relationship.</p>
        </article>
        <article className="tp-site-card">
          <h2>Essays / Manifesto</h2>
          <p>Future writing for theory, process notes, and long-form reflections.</p>
        </article>
        <article className="tp-site-card">
          <h2>Field Recordings</h2>
          <p>Archive space for recordings, textures, and locational memory.</p>
        </article>
      </section>
      <section className="tp-site-card tp-site-actions">
        <a className="tp-site-primary" href="/app/sky">Enter Sky Mode</a>
        <a className="tp-site-secondary" href="/about">About</a>
        <a className="tp-site-secondary" href="/field-recordings">Field Recordings</a>
        <a className="tp-site-secondary" href="/essays">Essays / Manifesto</a>
      </section>
    </SiteLayout>
  );
}

export function AboutPage() {
  return <SiteLayout title="About / Contact" description="Placeholder for project story, collaborators, and contact pathways." />;
}

export function FieldRecordingsPage() {
  return <SiteLayout title="Field Recordings" description="Placeholder archive route for future recordings and releases." />;
}

export function EssaysPage() {
  return <SiteLayout title="Essays / Manifesto" description="Placeholder route for writing, theory, and worldbuilding texts." />;
}

export function ChaosPlaceholderPage() {
  return (
    <SiteLayout
      title="Chaos Mode (Future)"
      description="Chaos Mode route is reserved for a future playable system while Sky Mode remains the active instrument."
    >
      <section className="tp-site-card tp-site-actions">
        <a className="tp-site-primary" href="/app/sky">Launch Sky Mode</a>
      </section>
    </SiteLayout>
  );
}
