import SiteLayout from "./SiteLayout";

function OverviewCards() {
  return (
    <div className="tp-site-overview-grid">
      <article className="tp-site-overview-card">
        <h2>World</h2>
        <p>Public essays, field notes, and a living archive of atmosphere.</p>
      </article>
      <article className="tp-site-overview-card">
        <h2>Sky</h2>
        <p>An interactive instrument tuned by time, cloud, sun, and moon.</p>
      </article>
      <article className="tp-site-overview-card">
        <h2>Archive</h2>
        <p>Recorded environments and sonic traces from specific places.</p>
      </article>
      <article className="tp-site-overview-card">
        <h2>Contact</h2>
        <p>Collaborators, context, and pathways into the work.</p>
      </article>
    </div>
  );
}

export function SiteHomePage() {
  return (
    <SiteLayout
      isHomePage
      title="TechnoPeace"
      subtitle="Calm systems for peace, weather, and attention."
      description="A cinematic world site and a gateway into Sky Mode, where live local conditions gently shape light, haze, and sound."
    >
      <OverviewCards />
    </SiteLayout>
  );
}

export function AboutPage() {
  return (
    <SiteLayout
      title="About / Contact"
      description="Project story, collaborators, and contact pathways live here as dedicated world-page content."
      showHeroActions={false}
    >
      <section className="tp-site-page-content">
        <p>This page is reserved for the project story, collaborator context, and contact details.</p>
      </section>
    </SiteLayout>
  );
}

export function FieldRecordingsPage() {
  return (
    <SiteLayout title="Field Recordings" description="Archive route for recordings and releases." showHeroActions={false}>
      <section className="tp-site-page-content">
        <p>Field recordings and atmosphere captures are presented here with room for full entries.</p>
      </section>
    </SiteLayout>
  );
}

export function EssaysPage() {
  return (
    <SiteLayout title="Essays / Manifesto" description="Writing, theory, and worldbuilding texts." showHeroActions={false}>
      <section className="tp-site-page-content">
        <p>Essays and manifesto writing live here in a clean readable layout.</p>
      </section>
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
