import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAudioEngine } from "../hooks/useAudioEngine";

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

type Pt = { x: number; y: number; pressure: number };
type Channel = {
  id: string;
  name: string;
  detail: string;
  value: number;
  autoValue?: number;
  enabled: boolean;
};
type MixerPage = { id: string; title: string; blurb: string; channels: Channel[] };

const initialMixerPages: MixerPage[] = [
  {
    id: "weather",
    title: "Weather channels",
    blurb: "Blend the sky's natural voices into the live field.",
    channels: [
      {
        id: "rain",
        name: "Rain",
        detail: "Soft roof hiss and droplets that sharpen texture.",
        value: 0.74,
        autoValue: 0.74,
        enabled: true,
      },
      {
        id: "wind",
        name: "Wind",
        detail: "Wide gusts and airy movement across the filter bed.",
        value: 0.68,
        autoValue: 0.68,
        enabled: true,
      },
      {
        id: "thunder",
        name: "Thunder",
        detail: "Low rolls and distant strikes that weight the sub layer.",
        value: 0.36,
        autoValue: 0.36,
        enabled: true,
      },
      {
        id: "waves",
        name: "Waves",
        detail: "Slow surf and shoreline wash carrying the tonal motion.",
        value: 0.44,
        autoValue: 0.44,
        enabled: true,
      },
    ],
  },
  {
    id: "man-made",
    title: "Man-made channels",
    blurb: "Shape supporting urban and mechanical layers around the weather bed.",
    channels: [
      {
        id: "train",
        name: "Train",
        detail: "Steel rhythm and rail hum to roughen the field.",
        value: 0.29,
        autoValue: 0.29,
        enabled: true,
      },
      {
        id: "traffic",
        name: "Traffic",
        detail: "Passing tires and city motion adding movement to the noise floor.",
        value: 0.52,
        autoValue: 0.52,
        enabled: true,
      },
      {
        id: "factory",
        name: "Factory",
        detail: "Machine drones and clanks for a harder industrial edge.",
        value: 0.24,
        autoValue: 0.24,
        enabled: true,
      },
      {
        id: "harbor",
        name: "Harbor",
        detail: "Buoys, horns, and distant engines deepening the ambient bed.",
        value: 0.33,
        autoValue: 0.33,
        enabled: true,
      },
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

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default function SkyInstrument() {
  const elRef = useRef<HTMLDivElement | null>(null);
  const { start, update, isRunning } = useAudioEngine();

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
  const mixerLevels = useMemo(
    () =>
      Object.fromEntries(
        mixerPages.flatMap((page) =>
          page.channels.map((channel) => [channel.id, channel.enabled ? channel.value : 0]),
        ),
      ),
    [mixerPages],
  );

  useEffect(() => {
    update({ ...pt, mixer: mixerLevels });
  }, [mixerLevels, pt, update]);

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
    update({ x, y, pressure, mixer: mixerLevels });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (mixerOpen || e.buttons === 0) return;
    const { x, y } = getXY(e);
    const pressure = clamp01((e.pressure || 0.5) * 1.0);

    setPt({ x, y, pressure });
    update({ x, y, pressure, mixer: mixerLevels });
  }

  function onPointerUp(e: React.PointerEvent) {
    if (mixerOpen) return;
    const { x, y } = getXY(e);
    const nextPt = { x, y, pressure: 0 };
    setPt(nextPt);
    update({ ...nextPt, mixer: mixerLevels });
  }

  function stopMixerEvent(e: React.PointerEvent | React.MouseEvent) {
    e.stopPropagation();
  }

  function updateChannelValue(pageId: string, channelId: string, value: number) {
    setMixerPages((pages) =>
      pages.map((page) =>
        page.id !== pageId
          ? page
          : {
              ...page,
              channels: page.channels.map((channel) =>
                channel.id === channelId ? { ...channel, value } : channel,
              ),
            },
      ),
    );
  }

  function toggleChannel(pageId: string, channelId: string) {
    setMixerPages((pages) =>
      pages.map((page) =>
        page.id !== pageId
          ? page
          : {
              ...page,
              channels: page.channels.map((channel) =>
                channel.id === channelId
                  ? { ...channel, enabled: !channel.enabled }
                  : channel,
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
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        touchAction: mixerOpen ? "pan-x pan-y" : "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        background:
          "radial-gradient(1200px 700px at 30% 10%, rgba(170, 210, 255, 0.16), transparent 60%), radial-gradient(900px 600px at 70% 40%, rgba(140, 160, 255, 0.14), transparent 62%), linear-gradient(180deg, rgba(10,12,22,1) 0%, rgba(6,7,14,1) 100%)",
      }}
    >
      <style>{`
        .tp-mixer-overlay { position: absolute; inset: 0; z-index: 2; display: grid; align-items: end; padding: 16px; background: rgba(4, 6, 14, 0.48); backdrop-filter: blur(14px); touch-action: pan-x pan-y; }
        .tp-mixer-panel { width: min(1040px, 100%); margin: 0 auto; border-radius: 28px; border: 1px solid rgba(255,255,255,0.12); background: linear-gradient(180deg, rgba(14, 20, 38, 0.92), rgba(9, 14, 28, 0.94)); box-shadow: 0 32px 60px rgba(0,0,0,0.35); padding: 20px; display: grid; gap: 20px; max-height: calc(100vh - 32px); overflow: hidden; }
        .tp-mixer-header { display: grid; gap: 16px; }
        .tp-mixer-page-pills { display: flex; gap: 12px; flex-wrap: wrap; }
        .tp-mixer-channel-browser { display: flex; gap: 16px; overflow-x: auto; overflow-y: hidden; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; padding: 4px 2px 8px; scrollbar-width: thin; touch-action: pan-x; }
        .tp-mixer-channel-browser::-webkit-scrollbar { height: 8px; }
        .tp-mixer-channel-browser::-webkit-scrollbar-thumb { background: rgba(163, 191, 255, 0.28); border-radius: 999px; }
        .tp-mixer-card { min-width: 85vw; max-width: 85vw; scroll-snap-align: center; flex: 0 0 auto; padding: 18px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.08); background: linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.035)); display: grid; gap: 16px; }
        .tp-slider { width: 100%; accent-color: rgb(137, 183, 255); }
        .tp-mixer-toggle { display: inline-flex; align-items: center; gap: 8px; align-self: start; padding: 8px 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.9); }
        @media (min-width: 768px) {
          .tp-mixer-overlay { align-items: center; padding: 24px; }
          .tp-mixer-panel { padding: 28px; }
          .tp-mixer-header { grid-template-columns: minmax(0, 1fr) auto; align-items: start; }
          .tp-mixer-channel-browser { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); overflow: visible; padding: 0; }
          .tp-mixer-card { min-width: 0; max-width: none; }
        }
      `}</style>

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
        }}
      >
        <div>audio: {isRunning ? "on" : "off"}</div>
        <div>
          x: {pt.x.toFixed(2)} y: {pt.y.toFixed(2)}
        </div>
        <div>pressure: {pt.pressure.toFixed(2)}</div>
      </div>

      {mixerOpen && activePage && (
        <div className="tp-mixer-overlay" onPointerDown={stopMixerEvent}>
          <div className="tp-mixer-panel">
            <div className="tp-mixer-header">
              <div>
                <div
                  style={{
                    fontSize: 12,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "rgba(182, 208, 255, 0.74)",
                  }}
                >
                  Mixer overlay
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
                  {activePage.blurb} Adjustments update the field and audio engine immediately.
                </p>
              </div>

              <div className="tp-mixer-page-pills">
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
                        background: isActive
                          ? "rgba(120, 168, 255, 0.2)"
                          : "rgba(255,255,255,0.04)",
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

            <div className="tp-mixer-channel-browser">
              {activePage.channels.map((channel) => {
                const meterWidth = channel.enabled ? `${Math.round(channel.value * 100)}%` : "0%";
                return (
                  <article key={channel.id} className="tp-mixer-card">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "start",
                        justifyContent: "space-between",
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
                        <div
                          style={{
                            marginTop: 10,
                            fontSize: 24,
                            color: "white",
                            fontWeight: 600,
                          }}
                        >
                          {channel.name}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="tp-mixer-toggle"
                        onPointerDown={stopMixerEvent}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleChannel(activePage.id, channel.id);
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 999,
                            background: channel.enabled
                              ? "rgba(140, 220, 176, 1)"
                              : "rgba(255,255,255,0.35)",
                          }}
                        />
                        {channel.enabled ? "Live" : "Muted"}
                      </button>
                    </div>

                    <div style={{ color: "rgba(255,255,255,0.68)", lineHeight: 1.5 }}>
                      {channel.detail}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: 10,
                        padding: 14,
                        borderRadius: 18,
                        background: "rgba(5, 9, 18, 0.42)",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          color: "rgba(255,255,255,0.86)",
                        }}
                      >
                        <span>Current</span>
                        <strong>{formatPercent(channel.enabled ? channel.value : 0)}</strong>
                      </div>
                      <input
                        className="tp-slider"
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={channel.value}
                        onPointerDown={stopMixerEvent}
                        onChange={(e) =>
                          updateChannelValue(
                            activePage.id,
                            channel.id,
                            Number(e.currentTarget.value),
                          )
                        }
                        aria-label={`${channel.name} level`}
                      />
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          color: "rgba(182, 208, 255, 0.72)",
                          fontSize: 13,
                        }}
                      >
                        <span>Baseline</span>
                        <span>{formatPercent(channel.autoValue ?? channel.value)}</span>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: "auto",
                        display: "grid",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          height: 12,
                          borderRadius: 999,
                          background: "rgba(255,255,255,0.08)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: meterWidth,
                            height: "100%",
                            background:
                              "linear-gradient(90deg, rgba(120, 176, 255, 0.85), rgba(182, 214, 255, 0.95))",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          fontSize: 12,
                          color: "rgba(255,255,255,0.64)",
                        }}
                      >
                        <span>Weather-linked default ready</span>
                        <span>{channel.enabled ? "Live update" : "Muted"}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
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
              First touch starts audio. Move to shape tone and texture.
            </div>
            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
              Open the mixer to swipe through channels and rebalance the field live.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
