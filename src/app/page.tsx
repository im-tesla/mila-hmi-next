'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import MapClient from '@/components/MapClient';
import SettingsPanel from '@/components/SettingsPanel';
import Slider from '@/components/Slider';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/Toast';
import { useSetting, PANEL_WIDTHS } from '@/lib/settings';
import { useCustomApps, getFaviconUrl, getFaviconFallback, normalizeUrl, resolveFaviconUrl, extractFaviconColor, addCustomApp, removeCustomApp } from '@/lib/customApps';
import type { CustomApp } from '@/lib/customApps';

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

const APP_LIBRARY_APPS = ['youtube'] as const;

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

const GridIcon = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="5" r="2.5" />
    <circle cx="12" cy="5" r="2.5" />
    <circle cx="19" cy="5" r="2.5" />
    <circle cx="5" cy="12" r="2.5" />
    <circle cx="12" cy="12" r="2.5" />
    <circle cx="19" cy="12" r="2.5" />
    <circle cx="5" cy="19" r="2.5" />
    <circle cx="12" cy="19" r="2.5" />
    <circle cx="19" cy="19" r="2.5" />
  </svg>
);

// ─── Page ────────────────────────────────────────────────────────

const SPLASH_MS = 2500;
const HOLD_MS = 350;
const HOLD_DISMISS_MS = 4000;

export default function Home() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <HomeInner />
      </ToastProvider>
    </ErrorBoundary>
  );
}

function HomeInner() {
  const [active, setActive] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState<string | null>(null);
  const [volume, setVolume] = useState(100);
  const [showVolume, setShowVolume] = useState(false);
  const [extReady, setExtReady] = useState(true);
  const [splashDone, setSplashDone] = useState(false);
  const [servicesDisabled, setServicesDisabled] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [holdService, setHoldService] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAppLibrary, setShowAppLibrary] = useState(false);
  const [newAppName, setNewAppName] = useState('');
  const [newAppUrl, setNewAppUrl] = useState('');
  const [addError, setAddError] = useState('');
  // All iframes mount at boot (during the splash screen) so they're warm
  // and ready by the time the user taps a service. Inactive iframes are
  // hidden via the `hidden` attribute for browser throttling.

  const switchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<{ x: number; edge: boolean } | null>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  const volumeBtnRef = useRef<HTMLButtonElement>(null);
  const iframeRefs = useRef<Partial<Record<string, HTMLIFrameElement>>>({});

  const [panelSize] = useSetting('panelSize');
  const basePanelWidth = PANEL_WIDTHS[panelSize];

  const displayedService: string | null = fullscreen ?? active;

  const customApps = useCustomApps();

  function isBuiltInService(id: string): id is Service {
    return id === 'spotify' || id === 'youtube' || id === 'netflix' || id === 'settings';
  }

  function getServiceColor(id: string): string {
    if (isBuiltInService(id)) return SERVICE_COLOR[id];
    return 'var(--mila-accent, #818cf8)';
  }

  function getServiceSrc(id: string): string {
    if (isBuiltInService(id) && id !== 'settings') return SERVICE_SRC[id];
    return customApps.find((a) => a.id === id)?.url ?? '';
  }

  function getServiceName(id: string): string {
    if (isBuiltInService(id)) return id.charAt(0).toUpperCase() + id.slice(1);
    return customApps.find((a) => a.id === id)?.name ?? id;
  }

  // visibleContent decides which iframe/settings panel is painted. Set
  // immediately on open (so content appears as the panel slides in) and
  // only cleared after the close width transition finishes — otherwise
  // the iframe vanishes before the slide-out animation is visible.
  const [visibleContent, setVisibleContent] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Send a real pause command where the embedded service supports it.
  const pauseService = useCallback((svc: string) => {
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
  }, []);

  // Open / close / switch service.
  const handleClick = useCallback((service: string) => {
    if (switchTimer.current) { clearTimeout(switchTimer.current); switchTimer.current = null; }
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    setHoldService(null);
    setShowAppLibrary(false);

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
      setActive(null);
    } else {
      setActive(service);
      setVisibleContent(service);
    }
  }, [active, fullscreen, pauseService]);

  const handlePointerDown = useCallback((svc: string) => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      setHoldService(svc);
    }, HOLD_MS);
  }, []);

  const handlePointerUp = useCallback((svc: string) => {
    if (!holdTimer.current) return;
    clearTimeout(holdTimer.current);
    holdTimer.current = null;
    handleClick(svc);
  }, [handleClick]);

  const handleFullscreen = useCallback((service: string) => {
    if (switchTimer.current) { clearTimeout(switchTimer.current); switchTimer.current = null; }
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    setHoldService(null);
    setShowAppLibrary(false);
    setShowVolume(false);
    if (fullscreen === service) {
      setFullscreen(null);
      return;
    }
    setVisibleContent(service);
    setFullscreen(service);
  }, [fullscreen]);

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

  // Dismiss app library popup on outside click.
  const appLibraryRef = useRef<HTMLDivElement>(null);
  const appLibraryBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!showAppLibrary) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (appLibraryBtnRef.current?.contains(target)) return;
      if (appLibraryRef.current && !appLibraryRef.current.contains(target)) {
        setShowAppLibrary(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [showAppLibrary]);

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

  // Prevent native context-menu in kiosk — long-press should never reload.
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', prevent);
    return () => document.removeEventListener('contextmenu', prevent);
  }, []);

  // Auto-dismiss fullscreen popup after timeout or outside tap.
  useEffect(() => {
    if (!holdService) return;
    const id = setTimeout(() => setHoldService(null), HOLD_DISMISS_MS);
    const onDown = (e: PointerEvent) => {
      if (holdRef.current && !holdRef.current.contains(e.target as Node)) {
        setHoldService(null);
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => { clearTimeout(id); document.removeEventListener('pointerdown', onDown); };
  }, [holdService]);

  // Cleanup any pending timers on unmount.
  useEffect(() => () => {
    if (switchTimer.current) clearTimeout(switchTimer.current);
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }, []);

  // Panel width: measure the container so fullscreen→normal transitions
  // stay in pixel units (avoid px↔% mismatch that kills the transition).
  const rowRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(0);
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setContainerW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const panelWidth = displayedService
    ? (fullscreen ? containerW : basePanelWidth)
    : 0;
  const contentWidth = fullscreen ? containerW : basePanelWidth;
  const panelOpen = panelWidth > 0;

  const onPanelTransitionEnd = useCallback(() => {
    if (!displayedService && !switchTimer.current) setVisibleContent(null);
  }, [displayedService]);

  const prevVisibleRef = useRef<string | null>(null);
  useEffect(() => {
    prevVisibleRef.current = visibleContent;
  }, [visibleContent]);

  // ─── Render ───────────────────────────────────────────────────

  return (
    <main className="w-screen h-screen flex flex-col overflow-hidden select-none">
      <div
        ref={rowRef}
        className="flex-1 min-h-0 relative"
        style={{ background: '#1a1a1a' }}
      >
        {/* Map — always fills the entire container. The clip-path
            smoothly clips from the right to make room for the panel.
            The WebGL canvas never resizes — no buffer clears, no black
            frames. The rightPadding prop tells Map to ease the viewport
            content left so the car stays centered in the visible area. */}
        <div
          className="absolute inset-0"
          style={{
            clipPath: panelOpen
              ? `inset(0 ${panelWidth}px 0 0)`
              : 'inset(0 0 0 0)',
            transition: 'clip-path var(--anim-duration, 0.3s) cubic-bezier(0.16, 1, 0.3, 1)',
            willChange: 'clip-path',
          }}
        >
          <MapClient rightPadding={panelWidth} />
        </div>


        {/* Panel — always containerW wide; clip-path limits the visible
            strip (GPU-composited). translateX slides the panel by exactly
            contentWidth so the slide distance matches the visible area. */}
        <div
          ref={panelRef}
          className="absolute top-0 right-0 h-full overflow-hidden"
          style={{
            width: containerW,
            background: 'var(--mila-surface, #f5f5f7)',
            clipPath: `inset(0 0 0 ${containerW - contentWidth}px)`,
            transform: panelOpen ? 'translateX(0)' : `translateX(${contentWidth}px)`,
            transition: panelOpen
              ? 'transform var(--anim-duration, 0.3s) cubic-bezier(0.16, 1, 0.3, 1), clip-path var(--anim-duration, 0.3s) cubic-bezier(0.16, 1, 0.3, 1)'
              : `transform var(--anim-duration, 0.3s) cubic-bezier(0.16, 1, 0.3, 1), visibility 0s var(--anim-duration, 0.3s)`,
            visibility: panelOpen ? 'visible' : 'hidden',
            willChange: 'transform, clip-path',
          }}
          onTransitionEnd={onPanelTransitionEnd}
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
          {/* iframes are right-aligned and animate width in sync with
              the panel's clip-path — same easing, same duration. The right
              edge is pinned; only the left edge moves. */}
          {!servicesDisabled && IFRAME_SERVICES.map((svc) => {
            const visible = visibleContent === svc;
            const throttled = visibleContent === null;
            const slideOut = prevVisibleRef.current === svc && !visible;
            return (
              <iframe
                key={svc}
                ref={(el) => {
                  if (el) iframeRefs.current[svc] = el;
                  else delete iframeRefs.current[svc];
                }}
                src={SERVICE_SRC[svc]}
                hidden={throttled}
                className="absolute top-0 right-0 h-full border-0"
                style={{
                  width: contentWidth,
                  opacity: visible ? 1 : 0,
                  pointerEvents: visible ? 'auto' : 'none',
                  transform: visible ? 'translateX(0)' : slideOut ? 'translateX(200px)' : 'translateX(200px)',
                  transition: [
                    'width var(--anim-duration, 0.3s) cubic-bezier(0.16, 1, 0.3, 1)',
                    'opacity var(--anim-duration, 0.3s) cubic-bezier(0.16, 1, 0.3, 1)',
                    'transform var(--anim-duration, 0.3s) cubic-bezier(0.16, 1, 0.3, 1)',
                  ].join(', '),
                }}
                allow="fullscreen; encrypted-media; autoplay; microphone; camera; geolocation"
                title={svc}
              />
            );
          })}

          {!servicesDisabled && customApps.map((app) => {
            const visible = visibleContent === app.id;
            const throttled = visibleContent === null;
            const slideOut = prevVisibleRef.current === app.id && !visible;
            return (
              <iframe
                key={app.id}
                ref={(el) => {
                  if (el) iframeRefs.current[app.id] = el;
                  else delete iframeRefs.current[app.id];
                }}
                src={app.url}
                hidden={throttled}
                className="absolute top-0 right-0 h-full border-0"
                style={{
                  width: contentWidth,
                  opacity: visible ? 1 : 0,
                  pointerEvents: visible ? 'auto' : 'none',
                  transform: visible ? 'translateX(0)' : slideOut ? 'translateX(200px)' : 'translateX(200px)',
                  transition: [
                    'width var(--anim-duration, 0.3s) cubic-bezier(0.16, 1, 0.3, 1)',
                    'opacity var(--anim-duration, 0.3s) cubic-bezier(0.16, 1, 0.3, 1)',
                    'transform var(--anim-duration, 0.3s) cubic-bezier(0.16, 1, 0.3, 1)',
                  ].join(', '),
                }}
                allow="fullscreen; encrypted-media; autoplay; microphone; camera; geolocation"
                title={app.name}
              />
            );
          })}

          <div
            hidden={visibleContent === null}
            className="absolute top-0 right-0 h-full overflow-hidden"
            style={{
              width: contentWidth,
              opacity: visibleContent === 'settings' ? 1 : 0,
              pointerEvents: visibleContent === 'settings' ? 'auto' : 'none',
              transition: 'opacity var(--anim-duration, 0.3s) cubic-bezier(0.16, 1, 0.3, 1)',
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
              className="py-4 px-3 rounded-3xl"
              style={{
                background: 'var(--mila-surface, #fff)',
                boxShadow: '0 8px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)',
                border: '1px solid var(--mila-border, #e5e5e5)',
                width: 44,
              }}
            >
              <Slider value={volume} onChange={setVolume} className="w-full h-40" />
            </div>
          </div>
        </div>

        {!servicesDisabled && (() => {
          const svc = 'spotify' as const;
          const isActive = active === svc || fullscreen === svc;
          const isHeld = holdService === svc;
          const Icon = iconMap[svc];
          return (
            <div key={svc} className="relative" ref={isHeld ? holdRef : undefined}>
              {isHeld && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleFullscreen(svc); }}
                  className="absolute -top-11 left-1/2 -translate-x-1/2 whitespace-nowrap px-4 py-2 rounded-xl text-sm font-semibold shadow-lg touch-none select-none z-10"
                  style={{
                    background: 'var(--mila-surface, #fff)',
                    color: 'var(--mila-text, #333)',
                    border: '1px solid var(--mila-border, #e5e5e5)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                  }}
                >
                  Fullscreen
                </button>
              )}
              <button
                type="button"
                onPointerDown={(e) => { e.preventDefault(); handlePointerDown(svc); }}
                onPointerUp={(e) => { e.preventDefault(); handlePointerUp(svc); }}
                onPointerLeave={() => { if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; } }}
                onPointerCancel={() => { if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; } }}
                onContextMenu={(e) => e.preventDefault()}
                onTouchStart={(e) => e.preventDefault()}
                onTouchEnd={(e) => e.preventDefault()}
                className="flex flex-col items-center justify-center border-0 bg-transparent cursor-pointer py-2 px-3 rounded-xl touch-none gap-1"
                style={{ color: SERVICE_COLOR[svc], WebkitTouchCallout: 'none' as any }}
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
            </div>
          );
        })()}

        {!servicesDisabled && (
          <button
            type="button"
            ref={appLibraryBtnRef}
            onClick={() => setShowAppLibrary((v) => !v)}
            className="flex flex-col items-center justify-center border-0 bg-transparent cursor-pointer py-2 px-3 rounded-xl touch-none gap-1"
            style={{ color: 'var(--mila-textSecondary, #999)' }}
          >
            <GridIcon size={36} />
            <div
              className="w-1 h-1 rounded-full transition-all duration-[var(--anim-duration,0.2s)]"
              style={{
                background: 'var(--mila-accent, #818cf8)',
                opacity: showAppLibrary ? 1 : 0,
                transform: showAppLibrary ? 'scale(1) translateY(2px)' : 'scale(0)',
              }}
            />
          </button>
        )}

        {!servicesDisabled && (() => {
          const svc = 'netflix' as const;
          const isActive = active === svc || fullscreen === svc;
          const isHeld = holdService === svc;
          const Icon = iconMap[svc];
          return (
            <div key={svc} className="relative" ref={isHeld ? holdRef : undefined}>
              {isHeld && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleFullscreen(svc); }}
                  className="absolute -top-11 left-1/2 -translate-x-1/2 whitespace-nowrap px-4 py-2 rounded-xl text-sm font-semibold shadow-lg touch-none select-none z-10"
                  style={{
                    background: 'var(--mila-surface, #fff)',
                    color: 'var(--mila-text, #333)',
                    border: '1px solid var(--mila-border, #e5e5e5)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                  }}
                >
                  Fullscreen
                </button>
              )}
              <button
                type="button"
                onPointerDown={(e) => { e.preventDefault(); handlePointerDown(svc); }}
                onPointerUp={(e) => { e.preventDefault(); handlePointerUp(svc); }}
                onPointerLeave={() => { if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; } }}
                onPointerCancel={() => { if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; } }}
                onContextMenu={(e) => e.preventDefault()}
                onTouchStart={(e) => e.preventDefault()}
                onTouchEnd={(e) => e.preventDefault()}
                className="flex flex-col items-center justify-center border-0 bg-transparent cursor-pointer py-2 px-3 rounded-xl touch-none gap-1"
                style={{ color: SERVICE_COLOR[svc], WebkitTouchCallout: 'none' as any }}
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
            </div>
          );
        })()}

        <div
            ref={appLibraryRef}
            className="absolute left-1/2 -translate-x-1/2 z-30 rounded-2xl p-6"
            style={{
              bottom: 'calc(100% + 8px)',
              width: 520,
              background: 'var(--mila-surface, #f5f5f7)',
              border: '1px solid var(--mila-border, #e5e5e5)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)',
              opacity: showAppLibrary ? 1 : 0,
              transition: 'opacity 350ms cubic-bezier(0.16, 1, 0.3, 1)',
              pointerEvents: showAppLibrary ? 'auto' : 'none',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--mila-text, #333)' }}>App Library</h3>
              <button
                type="button"
                onClick={() => setShowAppLibrary(false)}
                className="border-0 bg-transparent cursor-pointer p-1 rounded-lg"
                style={{ color: 'var(--mila-textSecondary, #999)' }}
              >
                <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.3 5.71a.996.996 0 00-1.41 0L12 10.59 7.11 5.7A.996.996 0 105.7 7.11L10.59 12 5.7 16.89a.996.996 0 101.41 1.41L12 13.41l4.89 4.89a.996.996 0 101.41-1.41L13.41 12l4.89-4.89c.38-.38.38-1.02 0-1.4z" />
                </svg>
              </button>
            </div>

            <div className="flex flex-wrap gap-4">
              {APP_LIBRARY_APPS.map((svc) => {
                const isActive = active === svc || fullscreen === svc;
                const isHeld = holdService === svc;
                const Icon = iconMap[svc];
                return (
                  <div key={svc} className="relative" ref={isHeld ? holdRef : undefined}>
                    {isHeld && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleFullscreen(svc); }}
                        className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-semibold shadow-lg touch-none select-none z-10"
                        style={{
                          background: 'var(--mila-surface, #fff)',
                          color: 'var(--mila-text, #333)',
                          border: '1px solid var(--mila-border, #e5e5e5)',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                        }}
                      >
                        Fullscreen
                      </button>
                    )}
                    <button
                      type="button"
                      onPointerDown={(e) => { e.preventDefault(); handlePointerDown(svc); }}
                      onPointerUp={(e) => { e.preventDefault(); handlePointerUp(svc); }}
                      onPointerLeave={() => { if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; } }}
                      onPointerCancel={() => { if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; } }}
                      onContextMenu={(e) => e.preventDefault()}
                      onTouchStart={(e) => e.preventDefault()}
                      onTouchEnd={(e) => e.preventDefault()}
                      className="flex flex-col items-center gap-1.5 border-0 bg-transparent cursor-pointer p-3 rounded-xl touch-none w-20"
                      style={{ color: SERVICE_COLOR[svc] as string, WebkitTouchCallout: 'none' as any }}
                    >
                      <Icon size={44} />
                      <span className="text-xs font-medium truncate w-full text-center" style={{ color: 'var(--mila-textSecondary, #999)' }}>
                        YouTube
                      </span>
                    </button>
                  </div>
                );
              })}

              {customApps.map((app) => {
                const isActive = active === app.id || fullscreen === app.id;
                const isHeld = holdService === app.id;
                const color = app.color || getServiceColor(app.id);
                return (
                  <div key={app.id} className="relative" ref={isHeld ? holdRef : undefined}>
                    {isHeld && (
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleFullscreen(app.id); }}
                          className="whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-semibold shadow-lg touch-none select-none"
                          style={{
                            background: 'var(--mila-surface, #fff)',
                            color: 'var(--mila-text, #333)',
                            border: '1px solid var(--mila-border, #e5e5e5)',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                          }}
                        >
                          Fullscreen
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCustomApp(app.id);
                            if (active === app.id) setActive(null);
                            if (fullscreen === app.id) setFullscreen(null);
                            if (visibleContent === app.id) setVisibleContent(null);
                            if (holdService === app.id) setHoldService(null);
                          }}
                          className="whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-semibold shadow-lg touch-none select-none"
                          style={{ background: '#ef4444', color: '#fff', boxShadow: '0 4px 20px rgba(239,68,68,0.25)' }}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onPointerDown={(e) => { e.preventDefault(); handlePointerDown(app.id); }}
                      onPointerUp={(e) => { e.preventDefault(); handlePointerUp(app.id); }}
                      onPointerLeave={() => { if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; } }}
                      onPointerCancel={() => { if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; } }}
                      onContextMenu={(e) => e.preventDefault()}
                      onTouchStart={(e) => e.preventDefault()}
                      onTouchEnd={(e) => e.preventDefault()}
                      className="flex flex-col items-center gap-1.5 border-0 bg-transparent cursor-pointer p-3 rounded-xl touch-none w-20"
                      style={{ color, WebkitTouchCallout: 'none' as any }}
                    >
                      <img
                        src={app.faviconUrl || getFaviconUrl(app.url)}
                        alt={app.name}
                        width={44}
                        height={44}
                        style={{ borderRadius: 8, display: 'block' }}
                        data-fallback="0"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          const attempt = Number(img.getAttribute('data-fallback') || '0');
                          if (attempt === 0) {
                            img.setAttribute('data-fallback', '1');
                            img.src = getFaviconFallback(app.url);
                          } else {
                            img.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44"><rect fill="%23666" width="44" height="44" rx="8"/><text fill="%23fff" x="22" y="29" text-anchor="middle" font-size="20" font-family="system-ui">' + app.name.charAt(0).toUpperCase() + '</text></svg>');
                          }
                        }}
                      />
                      <span className="text-xs font-medium truncate w-full text-center" style={{ color: 'var(--mila-textSecondary, #999)' }}>
                        {app.name}
                      </span>
                    </button>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => { setShowAddModal(true); setAddError(''); setNewAppName(''); setNewAppUrl(''); }}
                className="flex flex-col items-center gap-1.5 border-2 border-dashed bg-transparent cursor-pointer p-3 rounded-xl touch-none w-20"
                style={{ color: 'var(--mila-textSecondary, #999)', borderColor: 'var(--mila-border, #e5e5e5)' }}
              >
                <svg width={44} height={44} viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.5 }}>
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                </svg>
                <span className="text-xs font-medium" style={{ color: 'var(--mila-textSecondary, #999)' }}>Add App</span>
              </button>
            </div>
          </div>


        <div className="absolute right-6 top-1/2 -translate-y-1/2">
          <button
            type="button"
            onClick={() => {
              if (fullscreen) {
                setFullscreen(null);
                setActive('settings');
                setVisibleContent('settings');
                return;
              }
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
          className={`flex items-center gap-4 px-6 py-4 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.12)]
            transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
            ${showRestore ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}`}
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

      {showAddModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.35)' }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="rounded-2xl p-8 w-[440px] flex flex-col gap-5"
            style={{
              background: 'var(--mila-bg, #1a1a1a)',
              border: '1px solid var(--mila-border, #333333)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold" style={{ color: 'var(--mila-text, #f5f5f7)' }}>
              Add Application
            </h2>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: 'var(--mila-textSecondary, #999)' }}>Name</label>
              <input
                type="text"
                value={newAppName}
                onChange={(e) => { setNewAppName(e.target.value); setAddError(''); }}
                placeholder="e.g. Apple Music"
                className="px-4 py-3 rounded-xl border-0 outline-none text-base"
                style={{
                  background: 'var(--mila-surface, #2a2a2a)',
                  color: 'var(--mila-text, #f5f5f7)',
                  border: addError ? '1px solid #ef4444' : '1px solid var(--mila-border, #333333)',
                }}
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: 'var(--mila-textSecondary, #999)' }}>URL</label>
              <input
                type="url"
                value={newAppUrl}
                onChange={(e) => { setNewAppUrl(e.target.value); setAddError(''); }}
                placeholder="e.g. music.apple.com"
                className="px-4 py-3 rounded-xl border-0 outline-none text-base"
                style={{
                  background: 'var(--mila-surface, #2a2a2a)',
                  color: 'var(--mila-text, #f5f5f7)',
                  border: addError ? '1px solid #ef4444' : '1px solid var(--mila-border, #333333)',
                }}
              />
            </div>

            {addError && (
              <p className="text-sm" style={{ color: '#ef4444' }}>{addError}</p>
            )}

            <div className="flex gap-3 justify-end mt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-6 py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
                style={{
                  background: 'var(--mila-surface, #2a2a2a)',
                  color: 'var(--mila-text, #f5f5f7)',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const name = newAppName.trim();
                  if (!name) { setAddError('Please enter a name'); return; }
                  const normalized = normalizeUrl(newAppUrl);
                  if (!normalized) { setAddError('Please enter a valid URL'); return; }
                  const faviconUrl = await resolveFaviconUrl(normalized);
                  const iconSource = faviconUrl || getFaviconUrl(normalized);
                  let color = await extractFaviconColor(iconSource);
                  if (!color) color = await extractFaviconColor(getFaviconFallback(normalized));
                  const result = addCustomApp(name, normalized, color ?? undefined, faviconUrl ?? undefined);
                  if (!result) { setAddError('This URL has already been added'); return; }
                  setShowAddModal(false);
                  setNewAppName('');
                  setNewAppUrl('');
                  setAddError('');
                }}
                className="px-6 py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
                style={{
                  background: 'var(--mila-accent, #818cf8)',
                  color: '#fff',
                }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
