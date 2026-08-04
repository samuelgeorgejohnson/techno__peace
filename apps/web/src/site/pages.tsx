import SiteLayout from "./SiteLayout";

export function SiteHomePage() {
  return (
    <SiteLayout
      isHomePage
      title="TechnoPeace"
      subtitle="Calm systems for peace, weather, and attention."
      description="A cinematic world site and a gateway into Sky Mode, where live local conditions gently shape light, haze, and sound."
    />
  );
}

export function AboutPage() {
  return (
    <SiteLayout
      title="About TechnoPeace"
      description="About and mission: building calm systems for peace, weather, and attention through atmospheric media and instrument design."
      showHeroActions={false}
    >
      <section className="tp-site-page-content">
        <p>
          TechnoPeace is an ongoing practice focused on peaceful interfaces, reflective environments, and tools that help people
          sense place with more care.
        </p>
        <p>
          Mission: create public-facing works where weather, light, and sound become gentle signals for attention rather than
          noise—supporting calm, curiosity, and connection.
        </p>
      </section>
    </SiteLayout>
  );
}

export function ProjectsPage() {
  return (
    <SiteLayout
      title="Projects"
      description="A lightweight index of current public project areas."
      showHeroActions={false}
    >
      <section className="tp-site-page-content">
        <h2>Essays</h2>
        <p>Writing, theory, and worldbuilding texts.</p>
        <p><a className="tp-site-inline-link" href="/projects/essays">Open Essays</a></p>

        <h2>Field Recordings</h2>
        <p>Atmosphere captures, notes, and environmental studies.</p>
        <p><a className="tp-site-inline-link" href="/projects/field-recordings">Open Field Recordings</a></p>
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
    <SiteLayout title="Essays" description="Writing, theory, and worldbuilding texts." showHeroActions={false}>
      <section className="tp-site-page-content">
        <p>Essays and manifesto writing live here in a clean readable layout.</p>
      </section>
    </SiteLayout>
  );
}

export function ContactPage() {
  return (
    <SiteLayout
      title="Contact"
      description="Contact and collaboration pathways for artistic, research, and educational work."
      showHeroActions={false}
    >
      <section className="tp-site-page-content">
        <p>For collaborations, commissions, workshops, or press, please reach out via the project contact channels.</p>
      </section>
    </SiteLayout>
  );
}

export function ChaosPlaceholderPage() {
  return (
    <SiteLayout
      title="Chaos Mode (Future)"
      description="Chaos Mode route is reserved for a future playable system while Sky Mode remains the active instrument."
      showHeroActions={false}
    >
      <section className="tp-site-page-content">
        <p><a className="tp-site-inline-link" href="/app">Launch Sky Mode</a></p>
      </section>
    </SiteLayout>
  );
}
