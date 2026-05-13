'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import MapClient from '@/components/MapClient';
import SettingsPanel from '@/components/SettingsPanel';
import Slider from '@/components/Slider';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useSetting, PANEL_WIDTHS } from '@/lib/settings';

// ─── Service definitions ────────────────────────────────────────

type Service = 'spotify' | 'youtube' | 'netflix' | 'settings';
const IFRAME_SERVICES: readonly Exclude<Service, 'settings'>[] = ['spotify', 'youtube', 'netflix'];

const SERVICE_SRC: Record<Exclude<Service, 'settings'>, string> = {
  // YouTube embed mode + JS API enabled lets us send a real pause command.
  spotify: 'https://open.spotify.com',
  youtube: 'https://www.youtube.com/?app=desktop',
  netflix: 'https://www.netflix.com',
};

const SERVICE_ORIGIN: Record<Exclude<Service, 'settings'>, string> = {
  spotify: 'https://open.spotify.com',
  youtube: 'https://www.youtube.com',
  netflix: 'https://www.netflix.com',
};

const SERVICE_COLOR: Record<Service, string> = {
  spotify: '#1ed760',
  youtube: '#ff0000',
  netflix: '#e50914',
  settings: '#007aff',
};

const SERVICE_ORDER = ['spotify', 'youtube', 'netflix'] as const;

// ─── Icons (hoisted, no per-render allocation) ───────────────────

const SpotifyIcon = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 9.48 8.16 6.12 9.18c-.6.181-1.2-.12-1.38-.6-.18-.48.12-1.021.6-1.2C9.12 6.36 15.48 6.72 19.8 9.36c.48.299.66.96.301 1.38-.3.42-.84.6-1.32.3h.3z" />
  </svg>
);

const YouTubeIcon = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

const NetflixIcon = ({ size = 28 }: { size?: number }) => {
  const s = Math.round(size * 0.88);
  return <img src="/netflix.svg" width={s} height={s} alt="Netflix" style={{ verticalAlign: 'middle' }} />;
};

const GearIcon = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
  </svg>
);

const VolumeIcon = ({ size = 24, level = 100 }: { size?: number; level?: number }) => {
  if (level === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
      </svg>
    );
  }
  if (level < 50) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
    </svg>
  );
};

const iconMap = { spotify: SpotifyIcon, youtube: YouTubeIcon, netflix: NetflixIcon } as const;

// ─── Page ────────────────────────────────────────────────────────

const HOLD_MS = 500;
const HOLD_DISMISS_MS = 4000;
const FULLSCREEN_DELAY_MS = 300;
const SPLASH_MS = 2500;

export default function Home() {
  return (
    <ErrorBoundary>
      <HomeInner />
    </ErrorBoundary>
  );
}

function HomeInner() {
  const [active, setActive] = useState<Service | null>(null);
  const [fullscreen, setFullscreen] = useState<Service | null>(null);
  const [holdService, setHoldService] = useState<Service | null>(null);
  const [volume, setVolume] = useState(100);
  const [showVolume, setShowVolume] = useState(false);
  const [extReady, setExtReady] = useState(true);
  const [splashDone, setSplashDone] = useState(false);
  const [servicesDisabled, setServicesDisabled] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  // All iframes mount at boot (during the splash screen) so they're warm
  // and ready by the time the user taps a service. Inactive iframes are
  // hidden via the `hidden` attribute for browser throttling.

  const switchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipeRef = useRef<{ x: number; edge: boolean } | null>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  const volumeBtnRef = useRef<HTMLButtonElement>(null);
  const holdRef = useRef<HTMLDivElement>(null);
  const iframeRefs = useRef<Partial<Record<Exclude<Service, 'settings'>, HTMLIFrameElement>>>({});

  const [panelSize] = useSetting('panelSize');
  const basePanelWidth = PANEL_WIDTHS[panelSize];

  const displayedService: Service | null = fullscreen ?? active;
  const open = displayedService !== null;

  // visibleContent decides which iframe/settings panel is painted. Set
  // immediately on open (so content appears as the panel slides in) and
  // only cleared after the close width transition finishes — otherwise
  // the iframe vanishes before the slide-out animation is visible.
  const [visibleContent, setVisibleContent] = useState<Service | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const onPanelTransitionEnd = useCallback(() => {
    if (!displayedService) setVisibleContent(null);
  }, [displayedService]);

  // Send a real pause command where the embedded service supports it.
  const pauseService = useCallback((svc: Exclude<Service, 'settings'>) => {
    const el = iframeRefs.current[svc];
    if (!el?.contentWindow) return;
    if (svc === 'youtube') {
      try {
        el.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
          SERVICE_ORIGIN.youtube,
        );
      } catch {}
    }
    // Spotify / Netflix have no public postMessage API. The browser pauses
    // video on hidden iframes; audio (Spotify) intentionally keeps playing
    // so background music continues during navigation.
  }, []);

  // Open / close / switch service.
  const handleClick = useCallback((service: Service) => {
    if (switchTimer.current) { clearTimeout(switchTimer.current); switchTimer.current = null; }


    const outgoing = fullscreen ?? active;
    if (outgoing && outgoing !== 'settings') pauseService(outgoing);

    if (fullscreen) {
      setFullscreen(null);
      if (fullscreen !== service) {
        setActive(service);
        setVisibleContent(service);
      }
      return;
    }
    if (active === service) {
      // closing — visibleContent cleared by onPanelTransitionEnd
      setActive(null);
    } else {
      setActive(service);
      setVisibleContent(service);
    }
  }, [active, fullscreen, pauseService]);

  const handlePointerDown = useCallback((service: Service) => {
    if (service === 'settings') return;
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      setHoldService(service);
    }, HOLD_MS);
  }, []);

  const handlePointerUp = useCallback((service: Service) => {
    if (!holdTimer.current) return;
    clearTimeout(holdTimer.current);
    holdTimer.current = null;
    handleClick(service);
  }, [handleClick]);

  const handleFullscreen = useCallback((service: Service) => {
    setVisibleContent(service);
    if (fullscreen && fullscreen !== 'settings') pauseService(fullscreen);
    if (active && active !== 'settings') pauseService(active);
    setHoldService(null);
    setActive(null);
    if (switchTimer.current) clearTimeout(switchTimer.current);
    switchTimer.current = setTimeout(() => {
      switchTimer.current = null;
      setFullscreen(service);
    }, FULLSCREEN_DELAY_MS);
  }, [active, fullscreen, pauseService]);

  // ─── Effects ──────────────────────────────────────────────────

  // Splash timer.
  useEffect(() => {
    const id = setTimeout(() => setSplashDone(true), SPLASH_MS);
    return () => clearTimeout(id);
  }, []);

  // Extension heartbeat — only update React state on transitions to avoid
  // a render every 2 s when nothing has changed.
  const wasExtDown = useRef(false);
  useEffect(() => {
    let misses = 0;
    let ready = true;
    const id = setInterval(() => {
      const present = document.cookie.includes('mila_ext=1');
      if (present) {
        misses = 0;
        if (!ready) {
          ready = true;
          if (!servicesDisabled) setExtReady(true);
          if (servicesDisabled && wasExtDown.current) setShowRestore(true);
          wasExtDown.current = false;
        }
      } else {
        misses++;
        if (misses >= 3 && ready) {
          ready = false;
          if (!servicesDisabled) setExtReady(false);
          wasExtDown.current = true;
        }
      }
    }, 2000);
    return () => clearInterval(id);
  }, [servicesDisabled]);

  // Dismiss volume popup on outside click.
  useEffect(() => {
    if (!showVolume) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (volumeRef.current?.contains(target)) return;
      if (volumeBtnRef.current?.contains(target)) return;
      setShowVolume(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [showVolume]);

  // Auto-dismiss fullscreen affordance after timeout, or on outside click.
  useEffect(() => {
    if (!holdService) return;
    const id = setTimeout(() => setHoldService(null), HOLD_DISMISS_MS);
    const onDown = (e: PointerEvent) => {
      if (holdRef.current && !holdRef.current.contains(e.target as Node)) {
        setHoldService(null);
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => {
      clearTimeout(id);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [holdService]);

  // Cleanup any pending timers on unmount.
  useEffect(() => () => {
    if (switchTimer.current) clearTimeout(switchTimer.current);
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }, []);

  // Panel width: measure the container so fullscreen→normal transitions
  // stay in pixel units (avoid px↔% mismatch that kills the transition).
  const rowRef = useRef<HTMLDivElement>(null);
  // Seed with window width so fullscreen→normal transition has a starting value.
  const [containerW, setContainerW] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 0,
  );
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setContainerW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const panelWidth: number = open || fullscreen
    ? (fullscreen ? containerW : basePanelWidth)
    : 0;

  const contentWidth = fullscreen ? containerW : basePanelWidth;

  // ─── Render ───────────────────────────────────────────────────

  return (
    <main className="w-screen h-screen flex flex-col overflow-hidden select-none">
      <div
        ref={rowRef}
        className="flex-1 min-h-0 grid"
        style={{
          gridTemplateColumns: `1fr ${panelWidth}px`,
          transition: 'grid-template-columns var(--anim-duration, 0.3s) ease-in-out',
          background: '#1a1a1a',
        }}
        onTransitionEnd={onPanelTransitionEnd}
      >
        <div className="relative" style={{ background: '#1a1a1a' }}>
          <MapClient />
        </div>

        <div
          ref={panelRef}
          className="overflow-hidden relative"
          style={{ background: 'var(--mila-surface, #f5f5f7)' }}
          onTouchStart={(e) => {
            const t = e.touches[0];
            swipeRef.current = { x: t.clientX, edge: t.clientX - e.currentTarget.getBoundingClientRect().left < 40 };
          }}
          onTouchEnd={(e) => {
            const s = swipeRef.current;
            if (!s || !s.edge) { swipeRef.current = null; return; }
            const dx = e.changedTouches[0].clientX - s.x;
            if (dx > 60) {
              if (fullscreen) setFullscreen(null);
              else setActive(null);
              if (switchTimer.current) { clearTimeout(switchTimer.current); switchTimer.current = null; }
            }
            swipeRef.current = null;
          }}
        >
          {!servicesDisabled && IFRAME_SERVICES.map((svc) => {
            const visible = visibleContent === svc;
            const throttled = visibleContent === null;
            return (
              <iframe
                key={svc}
                ref={(el) => {
                  if (el) iframeRefs.current[svc] = el;
                  else delete iframeRefs.current[svc];
                }}
                src={SERVICE_SRC[svc]}
                hidden={throttled}
                className="absolute top-0 left-0 h-full border-0"
                style={{
                  width: contentWidth,
                  opacity: visible ? 1 : 0,
                  pointerEvents: visible ? 'auto' : 'none',
                  transition: 'opacity var(--anim-duration, 0.3s) ease-in-out',
                }}
                allow="fullscreen; encrypted-media; autoplay"
                title={svc}
              />
            );
          })}

          <div
            hidden={visibleContent === null}
            className="absolute top-0 left-0 h-full overflow-hidden"
            style={{
              width: contentWidth,
              opacity: visibleContent === 'settings' ? 1 : 0,
              pointerEvents: visibleContent === 'settings' ? 'auto' : 'none',
              transition: 'opacity var(--anim-duration, 0.3s) ease-in-out',
            }}
          >
            <SettingsPanel />
          </div>
        </div>
      </div>

      <div
        className="h-24 flex-shrink-0 flex items-center justify-center gap-6 relative"
        style={{ background: 'var(--mila-surface, rgba(245,245,247,0.94))' }}
      >
        <div className="absolute left-6 top-1/2 -translate-y-1/2 z-10">
          <button
            type="button"
            ref={volumeBtnRef}
            onClick={() => setShowVolume((v) => !v)}
            className="flex items-center justify-center border-0 bg-transparent cursor-pointer p-2 rounded-xl transition-colors duration-[var(--anim-duration,0.2s)]"
            style={{ color: showVolume ? 'var(--mila-accent, #0d9488)' : 'var(--mila-text, #333)' }}
          >
            <VolumeIcon size={32} level={volume} />
          </button>

          <div
            ref={volumeRef}
            className={`absolute left-1/2 -translate-x-1/2 z-20 transition-[opacity,transform] duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
              showVolume ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 translate-y-2 pointer-events-none'
            }`}
            style={{ bottom: 'calc(100% + 10px)', willChange: 'transform, opacity' }}
          >
            <div
              className="py-4 px-2 rounded-3xl"
              style={{
                background: 'var(--mila-surface, #fff)',
                boxShadow: '0 8px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)',
                border: '1px solid var(--mila-border, #e5e5e5)',
                width: 52,
              }}
            >
              <Slider value={volume} onChange={setVolume} className="w-full h-52" />
            </div>
          </div>
        </div>

        {!servicesDisabled && SERVICE_ORDER.map((svc) => {
          const isActive = active === svc || fullscreen === svc;
          const Icon = iconMap[svc];
          return (
            <div key={svc} className="relative" ref={holdService === svc ? holdRef : undefined}>
              <button
                type="button"
                onPointerDown={() => handlePointerDown(svc)}
                onPointerUp={() => handlePointerUp(svc)}
                onPointerLeave={() => {
                  if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
                }}
                className="flex flex-col items-center justify-center border-0 bg-transparent cursor-pointer py-2 px-3 rounded-xl touch-none gap-1"
                style={{ color: SERVICE_COLOR[svc] }}
              >
                <Icon size={36} />
                <div
                  className="w-1 h-1 rounded-full transition-all duration-[var(--anim-duration,0.2s)]"
                  style={{
                    background: SERVICE_COLOR[svc],
                    opacity: isActive ? 1 : 0,
                    transform: isActive ? 'scale(1) translateY(2px)' : 'scale(0)',
                  }}
                />
              </button>
              {holdService === svc && (
                <button
                  type="button"
                  onClick={() => handleFullscreen(svc)}
                  className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap px-4 py-2 rounded-xl text-sm font-medium shadow-lg transition-colors"
                  style={{ background: 'var(--mila-surface, rgba(255,255,255,0.95))', color: 'var(--mila-text, #333)' }}
                >
                  Fullscreen
                </button>
              )}
            </div>
          );
        })}

        <div className="absolute right-6 top-1/2 -translate-y-1/2">
          <button
            type="button"
            onClick={() => {
              setActive((curr) => {
                const next = curr === 'settings' ? null : 'settings';
                if (next) setVisibleContent(next);
                return next;
              });
            }}
            className="flex items-center justify-center border-0 bg-transparent cursor-pointer p-2 rounded-xl transition-colors duration-[var(--anim-duration,0.2s)]"
            style={{ color: active === 'settings' ? 'var(--mila-accent, #0d9488)' : 'var(--mila-text, #333)' }}
          >
            <GearIcon size={32} />
          </button>
        </div>
      </div>

      <div className="fixed left-0 right-0 bottom-24 flex justify-center z-50 pointer-events-none overflow-visible">
        <div
          className={`flex items-center gap-4 px-6 py-4 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] pointer-events-auto
            transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
            ${showRestore ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          style={{ background: 'var(--mila-surface, #fff)' }}
        >
          <span className="text-base font-medium" style={{ color: 'var(--mila-text, #333)' }}>Extension detected — restore services?</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-5 py-2 text-white rounded-xl text-sm font-medium transition-colors"
            style={{ background: 'var(--mila-accent, #0d9488)' }}
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowRestore(false)}
            className="px-5 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ background: 'var(--mila-surface, #f3f4f6)', color: 'var(--mila-textSecondary, #666)' }}
          >
            Dismiss
          </button>
        </div>
      </div>

      {!splashDone && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center" style={{ background: 'var(--mila-bg, #1a1a1a)' }}>
          <div className="text-center">
            <div
              className="w-12 h-12 border-2 rounded-full animate-spin mx-auto mb-6"
              style={{
                borderColor: 'var(--mila-border, #333333)',
                borderTopColor: 'var(--mila-accent, #0d9488)',
              }}
            />
            <p className="text-lg" style={{ color: 'var(--mila-textSecondary, #999)' }}>Loading system&hellip;</p>
          </div>
        </div>
      )}

      {splashDone && !extReady && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center" style={{ background: 'var(--mila-bg, #1a1a1a)' }}>
          <div className="text-center px-8">
            <div className="text-6xl mb-6">&#9888;</div>
            <h1 className="text-2xl font-semibold mb-3" style={{ color: 'var(--mila-text, #f5f5f7)' }}>Extension not detected</h1>
            <p className="text-lg max-w-md" style={{ color: 'var(--mila-textSecondary, #999)' }}>
              The mila-hmi-helper extension is required to run this system.
              Please install and enable it in <code style={{ color: 'var(--mila-accent, #0d9488)' }}>chrome://extensions</code>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setServicesDisabled(true); setExtReady(true); setShowRestore(false); }}
            className="absolute bottom-8 right-8 px-6 py-3 bg-white/10 rounded-xl text-base font-medium hover:bg-white/20 transition-colors"
            style={{ color: 'var(--mila-textSecondary, #999)' }}
          >
            Skip, no services
          </button>
        </div>
      )}
    </main>
  );
}
