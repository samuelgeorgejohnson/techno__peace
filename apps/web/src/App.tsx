import { useMemo } from "react";
import { useLocation } from "@technopeace/codex-map/src/useLocation";
import SkyInstrument from "./components/SkyInstrument";

function InstrumentApp() {
  const { location, error: locationError, isRequestingLocation, requestCurrentLocation, source } = useLocation();

  const locationText = useMemo(() => {
    if (location.placeName) {
      return location.placeName;
    }

    if (location.lat !== 0 || location.lon !== 0) {
      const sourceLabel = source === "manual" ? "manual" : source === "gps" ? "gps" : "default";
      return `${location.lat.toFixed(5)}, ${location.lon.toFixed(5)} (${sourceLabel})`;
    }

    if (locationError) {
      return `Location unavailable: ${locationError}`;
    }

    if (isRequestingLocation) {
      return "Requesting location…";
    }

    return "Location not requested yet.";
  }, [isRequestingLocation, location, locationError, source]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <SkyInstrument
        locationText={locationText}
        isRequestingLocation={isRequestingLocation}
        onRequestLocation={() => requestCurrentLocation(true)}
      />
    </div>
  );
}

function WebsiteLanding() {
  return (
    <main className="tp-site-shell">
      <section className="tp-site-hero tp-site-card">
        <p className="tp-eyebrow">TechnoPeace</p>
        <h1>World, signal, and instrument.</h1>
        <p>
          A public-facing space for mission, essays, visuals, field recordings, and contact—with a direct portal
          into the playable instrument.
        </p>
        <div className="tp-site-actions">
          <a className="tp-site-primary" href="/app">
            Enter Sky Mode
          </a>
          <a className="tp-site-secondary" href="/app?mode=chaos">
            Launch Chaos Mode
          </a>
        </div>
      </section>

      <section className="tp-site-grid">
        <article className="tp-site-card">
          <h2>Mission + Essays</h2>
          <p>Space for long-form worldbuilding, philosophy, and updates.</p>
        </article>
        <article className="tp-site-card">
          <h2>Visuals + Field Recordings</h2>
          <p>Archive sensory material and evolving narrative artifacts.</p>
        </article>
        <article className="tp-site-card">
          <h2>About + Contact</h2>
          <p>Keep collaboration, bookings, and press pathways separate from the instrument runtime.</p>
        </article>
      </section>
    </main>
  );
}

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const isInstrumentRoute = path === "/app" || path === "/instrument" || path === "/sky";

  return isInstrumentRoute ? <InstrumentApp /> : <WebsiteLanding />;
}
