import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAudioEngine } from "../hooks/useAudioEngine";
import { useCurrentWeatherSignal } from "../hooks/useCurrentWeatherSignal";
import { getSkyState } from "./getSkyState";

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

type Pt = { x: number; y: number; pressure: number };
type Channel = { id: string; name: string; detail: string; level: number };
type MixerPage = { id: string; title: string; blurb: string; channels: Channel[] };

const initialMixerPages: MixerPage[] = [
  {
    id: "weather",
    title: "Weather channels",
    blurb: "Blend the sky's natural voices into the instrument.",
    channels: [
      { id: "rain", name: "Rain", detail: "Soft roof hiss and droplets", level: 74 },
      { id: "wind", name: "Wind", detail: "Wide gusts and airy movement", level: 68 },
      { id: "thunder", name: "Thunder", detail: "Low rolls and distant strikes", level: 36 },
      { id: "waves", name: "Waves", detail: "Slow surf and shoreline wash", level: 44 },
    ],
  },
  {
    id: "man-made",
    title: "Man-made channels",
    blurb: "Shape the urban and mechanical layers around the weather bed.",
    channels: [
      { id: "train", name: "Train", detail: "Steel rhythm and rail hum", level: 29 },
      { id: "traffic", name: "Traffic", detail: "Passing tires and city motion", level: 52 },
      { id: "factory", name: "Factory", detail: "Machine drones and clanks", level: 24 },
      { id: "harbor", name: "Harbor", detail: "Buoys, horns, and distant engines", level: 33 },
    ],
  },
];

function FadersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 4V20M12 4V20M18 4V20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <rect x="4" y="7" width="4" height="4" rx="1.2" fill="currentColor" />
      <rect x="10" y="13" width="4" height="4" rx="1.2" fill="currentColor" />
      <rect x="16" y="9" width="4" height="4" rx="1.2" fill="currentColor" />
    </svg>
  );
}

export default function SkyInstrument() {
  const elRef = useRef<HTMLDivElement | null>(null);
  const { start, update, stop, isRunning } = useAudioEngine();
  const weather = useCurrentWeatherSignal();

  const [pt, setPt] = useState<Pt>({ x: 0.5, y: 0.5, pressure: 0 });
  const [hasInteracted, setHasInteracted] = useState(false);
  const [mixerOpen, setMixerOpen] = useState(false);
  const [activePageId, setActivePageId] = useState(initialMixerPages[0].id);
  const [mixerPages, setMixerPages] = useState<MixerPage[]>(initialMixerPages);

  const overlayVisible = useMemo(() => !hasInteracted, [hasInteracted]);
  const activePage = useMemo(
    () => mixerPages.find((page) => page.id === activePageId) ?? mixerPages[0],
    [activePageId, mixerPages],
  );
  const sky = useMemo(
    () =>
      getSkyState({
        sunAltitudeDeg: weather.sunAltitudeDeg,
        cloudCover: weather.cloudCover,
        windMps: weather.windMps,
      }),
    [weather.cloudCover, weather.sunAltitudeDeg, weather.windMps],
  );
  const rainVisual = useMemo(() => {
    if (weather.rainMm <= 0) return { opacity: 0, speedSec: 1.4, blur: 0.4 };
    if (weather.rainMm < 0.5) return { opacity: 0.18, speedSec: 1.05, blur: 0.35 };
    if (weather.rainMm < 2) return { opacity: 0.3, speedSec: 0.8, blur: 0.25 };
    return { opacity: 0.42, speedSec: 0.58, blur: 0.18 };
  }, [weather.rainMm]);

  function audioParams(nextPt: Pt) {
    return {
      ...nextPt,
      cloudCover: weather.cloudCover,
      rainMm: weather.rainMm,
      windMps: weather.windMps,
      sunAltitudeDeg: weather.sunAltitudeDeg,
      moonPhase: weather.moonPhase,
      temperatureC: weather.temperatureC,
    };
  }

  useEffect(() => {
    if (!isRunning) return;
    update(audioParams(pt));
  }, [isRunning, pt, update, weather.cloudCover, weather.moonPhase, weather.rainMm, weather.sunAltitudeDeg, weather.temperatureC, weather.windMps]);

  function getXY(e: React.PointerEvent) {
    const el = elRef.current;
    if (!el) return { x: 0.5, y: 0.5 };
    const r = el.getBoundingClientRect();
    const x = clamp01((e.clientX - r.left) / r.width);
    const y = clamp01((e.clientY - r.top) / r.height);
    return { x, y };
  }

  async function onPointerDown(e: React.PointerEvent) {
    if (mixerOpen) return;

    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    const { x, y } = getXY(e);
    const pressure = clamp01((e.pressure || 0.5) * 1.0);

    setHasInteracted(true);
    setPt({ x, y, pressure });

    await start();
    update(audioParams({ x, y, pressure }));
  }

  function onPointerMove(e: React.PointerEvent) {
    if (mixerOpen || e.buttons === 0) return;
    const { x, y } = getXY(e);
    const pressure = clamp01((e.pressure || 0.5) * 1.0);

    setPt({ x, y, pressure });
    update(audioParams({ x, y, pressure }));
  }

  function onPointerUp(e: React.PointerEvent) {
    if (mixerOpen) return;
    const { x, y } = getXY(e);
    setPt((p) => ({ ...p, x, y, pressure: 0 }));
    update(audioParams({ x, y, pressure: 0 }));
    stop();
  }

  function onPointerLeave() {
    setPt((p) => ({ ...p, pressure: 0 }));
    stop();
  }

  function stopMixerEvent(e: React.PointerEvent | React.MouseEvent) {
    e.stopPropagation();
  }

  function updateChannelLevel(pageId: string, channelId: string, level: number) {
    setMixerPages((pages) =>
      pages.map((page) =>
        page.id !== pageId
          ? page
          : {
              ...page,
              channels: page.channels.map((channel) =>
                channel.id === channelId ? { ...channel, level } : channel,
              ),
            },
      ),
    );
  }

  return (
    <div
      ref={elRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerLeave}
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        background: `linear-gradient(180deg, ${sky.topColor} 0%, ${sky.midColor} 54%, ${sky.horizonColor} 100%)`,
        filter: `brightness(${0.42 + sky.brightness * 0.42})`,
        transition: "background 900ms ease, filter 900ms ease",
      }}
    >
      <style>
        {`@keyframes tp-cloud-drift-a { from { transform: translateX(-8%); } to { transform: translateX(8%); } }
          @keyframes tp-cloud-drift-b { from { transform: translateX(10%); } to { transform: translateX(-10%); } }
          @keyframes tp-rain-fall { from { transform: translateY(-4%); } to { transform: translateY(4%); } }`}
      </style>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "-6% -8% 24%",
          pointerEvents: "none",
          background: `radial-gradient(1200px 420px at 50% 98%, rgba(255, 156, 108, ${0.08 + sky.horizonWarmth * 0.33}), rgba(255, 176, 120, 0) 72%)`,
          opacity: (1 - weather.cloudCover) * 0.85,
          zIndex: 0,
          mixBlendMode: "screen",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "-8% -8% -4%",
          pointerEvents: "none",
          background: `radial-gradient(1000px 520px at 50% 88%, rgba(255, 184, 128, ${0.06 + sky.goldenWarmth * 0.3}), rgba(255, 184, 128, 0) 72%)`,
          opacity: (1 - weather.cloudCover) * 0.9,
          zIndex: 0,
          mixBlendMode: "screen",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "-8%",
          pointerEvents: "none",
          zIndex: 0,
          opacity: sky.cloudOpacity,
          animation: `tp-cloud-drift-a ${Math.max(24, 170 / sky.cloudSpeed)}s linear infinite`,
          background:
            sky.cloudDensity === "low"
              ? "radial-gradient(800px 360px at 18% 20%, rgba(210,218,228,0.10), transparent 62%), radial-gradient(900px 380px at 78% 36%, rgba(210,218,228,0.10), transparent 64%)"
              : sky.cloudDensity === "medium"
                ? "linear-gradient(185deg, rgba(190,198,210,0.16) 4%, rgba(176,184,196,0.08) 20%, rgba(255,255,255,0) 34%), radial-gradient(1000px 420px at 16% 26%, rgba(188,196,206,0.15), transparent 66%), radial-gradient(1100px 500px at 74% 34%, rgba(188,196,206,0.13), transparent 70%)"
                : "linear-gradient(180deg, rgba(154,160,170,0.42) 0%, rgba(144,150,160,0.34) 30%, rgba(132,138,148,0.30) 64%, rgba(126,132,142,0.28) 100%)",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "-8%",
          pointerEvents: "none",
          zIndex: 0,
          opacity: sky.cloudOpacity * (sky.cloudDensity === "high" ? 0.75 : 0.48),
          animation: `tp-cloud-drift-b ${Math.max(18, 135 / sky.cloudSpeed)}s linear infinite`,
          background:
            sky.cloudDensity === "high"
              ? "radial-gradient(1200px 520px at 40% 16%, rgba(168,174,184,0.28), transparent 72%), radial-gradient(1200px 540px at 78% 28%, rgba(160,166,176,0.24), transparent 74%)"
              : "radial-gradient(1200px 520px at 12% 26%, rgba(205,212,222,0.13), transparent 72%), radial-gradient(1200px 560px at 86% 30%, rgba(205,212,222,0.11), transparent 74%)",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "-10%",
          pointerEvents: "none",
          zIndex: 1,
          opacity: rainVisual.opacity,
          animation: `tp-rain-fall ${rainVisual.speedSec}s linear infinite`,
          background:
            "repeating-linear-gradient(102deg, rgba(198,218,236,0.00) 0px, rgba(198,218,236,0.00) 10px, rgba(198,218,236,0.32) 10px, rgba(198,218,236,0.32) 12px, rgba(198,218,236,0.00) 12px, rgba(198,218,236,0.00) 24px)",
          filter: `blur(${rainVisual.blur}px)`,
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "auto -6% -12% -6%",
          height: "42%",
          pointerEvents: "none",
          zIndex: 1,
          opacity: Math.min(0.45, weather.dailyRainMm / 18),
          background:
            "radial-gradient(800px 240px at 20% 68%, rgba(178,208,232,0.24), transparent 72%), radial-gradient(820px 240px at 80% 72%, rgba(170,198,226,0.20), transparent 72%)",
          mixBlendMode: "screen",
        }}
      />

      <button
        type="button"
        onPointerDown={stopMixerEvent}
        onClick={(e) => {
          e.stopPropagation();
          setMixerOpen((open) => !open);
        }}
        aria-label={mixerOpen ? "Close mixer" : "Open mixer"}
        style={{
          position: "absolute",
          top: 18,
          right: 18,
          zIndex: 3,
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.14)",
          background: mixerOpen ? "rgba(102, 156, 255, 0.24)" : "rgba(0,0,0,0.35)",
          color: "rgba(255,255,255,0.94)",
          boxShadow: "0 12px 30px rgba(0, 0, 0, 0.25)",
          backdropFilter: "blur(12px)",
          cursor: "pointer",
        }}
      >
        <FadersIcon />
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          Mixer
        </span>
      </button>

      <div
        style={{
          position: "absolute",
          left: `calc(${pt.x * 100}% - 20px)`,
          top: `calc(${pt.y * 100}% - 20px)`,
          width: 40,
          height: 40,
          borderRadius: 999,
          background: "rgba(180, 220, 255, 0.85)",
          filter: "blur(0px)",
          boxShadow: "0 0 40px rgba(140,200,255,0.35)",
          transform: `scale(${1 + pt.pressure * 0.8})`,
          transition: "transform 40ms linear",
          pointerEvents: "none",
          opacity: mixerOpen ? 0.35 : 0.9,
          zIndex: 1,
        }}
      />

      <div
        style={{
          position: "absolute",
          right: 16,
          bottom: 16,
          padding: "10px 12px",
          borderRadius: 14,
          background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.86)",
          fontSize: 12,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          backdropFilter: "blur(10px)",
          pointerEvents: "none",
          zIndex: 3,
        }}
      >
        <div>audio: {isRunning ? "on" : "off"}</div>
        <div>
          x: {pt.x.toFixed(2)} y: {pt.y.toFixed(2)}
        </div>
        <div>pressure: {pt.pressure.toFixed(2)}</div>
        <div>weather: {weather.status}</div>
        <div>phase: {sky.phase}</div>
        <div>
          cloud: {(weather.cloudCover * 100).toFixed(0)}% wind: {weather.windMps.toFixed(1)} m/s
        </div>
        <div>
          rain: {weather.rainMm.toFixed(2)} mm precip: {weather.precipitationMm.toFixed(2)} mm
        </div>
        <div>daily rain: {weather.dailyRainMm.toFixed(1)} mm</div>
        <div>
          temp: {weather.temperatureC.toFixed(1)}°C sun: {weather.sunAltitudeDeg.toFixed(0)}°
        </div>
      </div>

      {mixerOpen && activePage && (
        <div
          onPointerDown={stopMixerEvent}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 2,
            display: "grid",
            placeItems: "center",
            padding: 24,
            background: "rgba(4, 6, 14, 0.48)",
            backdropFilter: "blur(14px)",
          }}
        >
          <div
            style={{
              width: "min(960px, 100%)",
              minHeight: "min(620px, 100%)",
              borderRadius: 28,
              border: "1px solid rgba(255,255,255,0.12)",
              background:
                "linear-gradient(180deg, rgba(14, 20, 38, 0.92), rgba(9, 14, 28, 0.92))",
              boxShadow: "0 32px 60px rgba(0,0,0,0.35)",
              padding: 28,
              display: "grid",
              gap: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 12,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "rgba(182, 208, 255, 0.74)",
                  }}
                >
                  Mixer pages
                </div>
                <h2
                  style={{
                    margin: "10px 0 6px",
                    fontSize: "clamp(28px, 4vw, 42px)",
                    color: "white",
                  }}
                >
                  {activePage.title}
                </h2>
                <p
                  style={{
                    margin: 0,
                    maxWidth: 540,
                    lineHeight: 1.5,
                    color: "rgba(255,255,255,0.72)",
                  }}
                >
                  {activePage.blurb}
                </p>
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {mixerPages.map((page) => {
                  const isActive = page.id === activePage.id;
                  return (
                    <button
                      key={page.id}
                      type="button"
                      onPointerDown={stopMixerEvent}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePageId(page.id);
                      }}
                      style={{
                        padding: "12px 16px",
                        borderRadius: 14,
                        border: isActive
                          ? "1px solid rgba(140,200,255,0.45)"
                          : "1px solid rgba(255,255,255,0.10)",
                        background: isActive ? "rgba(120, 168, 255, 0.2)" : "rgba(255,255,255,0.04)",
                        color: "white",
                        cursor: "pointer",
                      }}
                    >
                      {page.title}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 18,
                alignItems: "end",
              }}
            >
              {activePage.channels.map((channel) => (
                <div
                  key={channel.id}
                  style={{
                    padding: 18,
                    borderRadius: 22,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.04)",
                    minHeight: 320,
                    display: "grid",
                    gap: 12,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        letterSpacing: "0.15em",
                        textTransform: "uppercase",
                        color: "rgba(177, 206, 255, 0.76)",
                      }}
                    >
                      Channel
                    </div>
                    <div style={{ marginTop: 10, fontSize: 22, color: "white", fontWeight: 600 }}>
                      {channel.name}
                    </div>
                    <div style={{ marginTop: 8, color: "rgba(255,255,255,0.68)", lineHeight: 1.45 }}>
                      {channel.detail}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      color: "rgba(255,255,255,0.82)",
                    }}
                  >
                    <span>Level</span>
                    <strong>{channel.level}%</strong>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={channel.level}
                    onPointerDown={stopMixerEvent}
                    onChange={(e) =>
                      updateChannelLevel(activePage.id, channel.id, Number(e.currentTarget.value))
                    }
                    aria-label={`${channel.name} level`}
                    style={{ writingMode: "vertical-lr", width: "100%", height: 160 }}
                  />

                  <div
                    style={{
                      marginTop: "auto",
                      height: 10,
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.08)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${channel.level}%`,
                        height: "100%",
                        background:
                          "linear-gradient(90deg, rgba(120, 176, 255, 0.85), rgba(182, 214, 255, 0.95))",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {overlayVisible && !mixerOpen && (
        <div
          onPointerDown={stopMixerEvent}
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background: "rgba(0,0,0,0.15)",
            backdropFilter: "blur(2px)",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              textAlign: "center",
              padding: 18,
              borderRadius: 18,
              background: "rgba(0,0,0,0.35)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "rgba(255,255,255,0.9)",
              width: "min(360px, 86vw)",
            }}
          >
            <div style={{ letterSpacing: "0.18em", fontSize: 12, opacity: 0.8 }}>
              SKY MODE
            </div>
            <div style={{ fontSize: 20, marginTop: 10, fontWeight: 600 }}>
              Tap & drag anywhere
            </div>
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85, lineHeight: 1.4 }}>
              First touch starts audio. Move to shape tone while live weather colors the field.
            </div>
            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
              Use the mixer icon to open dedicated sound-channel pages.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
