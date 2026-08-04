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
        <a className="tp-site-primary" href="/app/sky">Launch Sky Mode</a>
      </section>
    </SiteLayout>
  );
}
