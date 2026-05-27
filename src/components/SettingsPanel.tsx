'use client';

import { useState, useEffect, useRef } from 'react';
import Slider from '@/components/Slider';
import {
  useSetting,
  isValidHex,
  THEME_COLORS,
  UI_SCALES,
  PANEL_WIDTHS,
  type Theme,
  type UiScale,
  type PanelSize,
  type Animations,
  type ThemeColors,
} from '@/lib/settings';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';

const icons = {
  Controls: (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="4" cy="12" r="2" /><line x1="6" y1="12" x2="20" y2="12" /><circle cx="12" cy="6" r="2" /><line x1="12" y1="8" x2="12" y2="20" /><circle cx="20" cy="18" r="2" /><line x1="20" y1="16" x2="6" y2="18" />
    </svg>
  ),
  Navigation: (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  ),
  Locks: (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  Lights: (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  ),
  Display: (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  Software: (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
    </svg>
  ),
};

type Tab = keyof typeof icons;
const TABS: Tab[] = ['Controls', 'Navigation', 'Locks', 'Lights', 'Display', 'Software'];

// ─── Shared atoms (hoisted — new identities each render is a perf cost) ────

function Toggle({
  label, desc, value, onChange,
}: { label: string; desc?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-2">
      <div>
        <span className="text-sm" style={{ color: 'var(--mila-textSecondary, #666)' }}>{label}</span>
        {desc && <p className="text-xs mt-0.5" style={{ color: 'var(--mila-textSecondary, #999)' }}>{desc}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`w-12 h-7 rounded-full transition-colors duration-[var(--anim-duration,0.2s)] relative ${value ? '' : 'bg-gray-300'}`}
        style={{ background: value ? 'var(--mila-accent, #0d9488)' : undefined }}
      >
        <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-[var(--anim-duration,0.2s)] ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </label>
  );
}

function ChoiceGroup<T extends string>({
  options, value, onChange, formatLabel,
}: { options: readonly T[]; value: T; onChange: (v: T) => void; formatLabel?: (v: T) => string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-[var(--anim-duration,0.15s)]"
            style={{
              background: selected ? 'var(--mila-accent, #0d9488)' : 'var(--mila-surface, #f3f4f6)',
              color: selected ? '#fff' : 'var(--mila-textSecondary, #666)',
            }}
          >
            {formatLabel ? formatLabel(opt) : opt}
          </button>
        );
      })}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-medium uppercase tracking-wide mb-4" style={{ color: 'var(--mila-textSecondary, #999)' }}>
      {children}
    </h3>
  );
}

// ─── Display tab ─────────────────────────────────────────────────

const THEMES_WITH_CUSTOM: readonly (Theme)[] = ['Dark', 'Light', 'Cute', 'Custom'];
const MAP_STYLES: { label: string; url: string }[] = [
  { label: '3D', url: 'mapbox://styles/mapbox/standard' },
  { label: 'Streets', url: 'mapbox://styles/mapbox/streets-v12' },
  { label: 'Outdoor', url: 'mapbox://styles/mapbox/outdoors-v12' },
  { label: 'Light', url: 'mapbox://styles/mapbox/light-v11' },
  { label: 'Dark', url: 'mapbox://styles/mapbox/dark-v11' },
  { label: 'Satellite', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
];
const ANIMATIONS_OPTIONS: readonly Animations[] = ['Full', 'Reduced', 'Off'];
const COLOR_FIELDS: { label: string; key: keyof ThemeColors }[] = [
  { label: 'Background', key: 'bg' },
  { label: 'Surface / cards', key: 'surface' },
  { label: 'Text primary', key: 'text' },
  { label: 'Text secondary', key: 'textSecondary' },
  { label: 'Accent', key: 'accent' },
  { label: 'Border', key: 'border' },
];

function DisplayTab() {
  const [theme, setTheme] = useSetting('theme');
  const [customColors, setCustomColors] = useSetting('customColors');
  const [mapStyle, setMapStyle] = useSetting('mapStyle');
  const [uiScale, setUiScale] = useSetting('uiScale');
  const [panelSize, setPanelSize] = useSetting('panelSize');
  const [animations, setAnimations] = useSetting('animations');
  const [showCustom, setShowCustom] = useState(false);
  const pickerRefs = useRef<Record<string, HTMLInputElement | null>>({});
  // Track local text input for hex fields so the user can type intermediate
  // values like "#1" without us writing them to the actual color until valid.
  const [hexDraft, setHexDraft] = useState<Partial<Record<keyof ThemeColors, string>>>({});

  return (
    <div className="space-y-8">
      <section>
        <SectionHeader>Theme</SectionHeader>
        <div className="flex gap-4 mb-4">
          {THEMES_WITH_CUSTOM.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setTheme(t); if (t === 'Custom') setShowCustom(true); }}
              className="flex flex-col items-center gap-2"
            >
              <div
                className={`w-16 h-10 rounded-lg border-2 transition-colors ${theme === t ? 'border-[#007aff]' : 'border-gray-200'}`}
                style={{
                  background: t === 'Custom'
                    ? 'conic-gradient(#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)'
                    : THEME_COLORS[t]?.bg ?? '#1a1a1a',
                }}
              />
              <span className="text-xs font-medium" style={{ color: theme === t ? 'var(--mila-accent, #0d9488)' : 'var(--mila-textSecondary, #999)' }}>{t}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader>Map style</SectionHeader>
        <div className="flex flex-wrap gap-2">
          {MAP_STYLES.map((s) => {
            const selected = mapStyle === s.url;
            return (
              <button
                key={s.url}
                type="button"
                onClick={() => setMapStyle(s.url)}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-[var(--anim-duration,0.15s)]"
                style={{
                  background: selected ? 'var(--mila-accent, #0d9488)' : 'var(--mila-surface, #f3f4f6)',
                  color: selected ? '#fff' : 'var(--mila-textSecondary, #666)',
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <SectionHeader>UI scale</SectionHeader>
        <ChoiceGroup
          options={Object.keys(UI_SCALES) as UiScale[]}
          value={uiScale}
          onChange={setUiScale}
        />
      </section>

      <section>
        <SectionHeader>Panel width</SectionHeader>
        <ChoiceGroup
          options={Object.keys(PANEL_WIDTHS) as PanelSize[]}
          value={panelSize}
          onChange={setPanelSize}
          formatLabel={(w) => `${w} (${PANEL_WIDTHS[w]}px)`}
        />
      </section>

      <section>
        <SectionHeader>Animations</SectionHeader>
        <ChoiceGroup options={ANIMATIONS_OPTIONS} value={animations} onChange={setAnimations} />
      </section>

      {showCustom && (
        <CustomThemeModal
          colors={customColors}
          hexDraft={hexDraft}
          onColorChange={(key, v) => {
            setHexDraft((d) => ({ ...d, [key]: v }));
            if (isValidHex(v)) setCustomColors({ ...customColors, [key]: v });
          }}
          onPickerChange={(key, v) => setCustomColors({ ...customColors, [key]: v })}
          pickerRefs={pickerRefs}
          onClose={() => setShowCustom(false)}
        />
      )}
    </div>
  );
}

function CustomThemeModal({
  colors, hexDraft, onColorChange, onPickerChange, pickerRefs, onClose,
}: {
  colors: ThemeColors;
  hexDraft: Partial<Record<keyof ThemeColors, string>>;
  onColorChange: (key: keyof ThemeColors, v: string) => void;
  onPickerChange: (key: keyof ThemeColors, v: string) => void;
  pickerRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-[var(--anim-duration,0.3s)]"
        onClick={onClose}
      />
      <div
        className="relative rounded-2xl p-8 w-[480px] max-h-[80vh] shadow-2xl"
        style={{ background: 'var(--mila-bg, #fff)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-semibold mb-6" style={{ color: 'var(--mila-text, #333)' }}>Custom theme</h3>
        <p className="text-base mb-8" style={{ color: 'var(--mila-textSecondary, #999)' }}>
          Pick colors for each element. This will be applied as a custom CSS theme.
        </p>

        <div className="space-y-4">
          {COLOR_FIELDS.map(({ label, key }) => {
            const v = hexDraft[key] ?? colors[key];
            return (
              <div key={key} className="flex items-center justify-between">
                <span className="text-base" style={{ color: 'var(--mila-textSecondary, #666)' }}>{label}</span>
                <div className="flex items-center gap-2">
                  <input
                    ref={(el) => { pickerRefs.current[key] = el; }}
                    type="color"
                    value={colors[key]}
                    onChange={(e) => onPickerChange(key, e.target.value)}
                    className="sr-only"
                  />
                  <button
                    type="button"
                    onClick={() => pickerRefs.current[key]?.click()}
                    className="w-7 h-7 rounded-full border border-gray-200 shadow-sm transition-transform hover:scale-110"
                    style={{ background: colors[key] }}
                  />
                  <input
                    type="text"
                    value={v}
                    onChange={(e) => onColorChange(key, e.target.value)}
                    className="w-28 text-base border border-gray-200 rounded-lg px-2 py-1.5 text-center font-mono"
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 mt-8">
          <button onClick={onClose} className="flex-1 px-5 py-3 rounded-xl text-base font-medium transition-colors"
            style={{ background: 'var(--mila-surface, #f3f4f6)', color: 'var(--mila-textSecondary, #666)' }}>
            Cancel
          </button>
          <button onClick={onClose} className="flex-1 px-5 py-3 text-white rounded-xl text-base font-medium transition-colors"
            style={{ background: 'var(--mila-accent, #0d9488)' }}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Software tab ────────────────────────────────────────────────

const startTime = typeof performance !== 'undefined' ? performance.now() : 0;

const fmtUptime = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}h ${m}m ${sec}s` : m ? `${m}m ${sec}s` : `${sec}s`;
};

function SoftwareTab() {
  const [perf, setPerf] = useState({ fps: 0, frameTime: 0, uptime: 0, memMB: '-' as string | number });

  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    let last = performance.now();
    let frames = 0;
    let acc = 0;
    let lastEmit = last;

    const tick = (now: number) => {
      if (cancelled) return;
      const dt = now - last;
      last = now;
      frames++;
      acc += dt;
      // Emit once per second; avoids 60 setState calls/sec.
      if (now - lastEmit >= 1000) {
        const avg = acc / frames;
        const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
        setPerf({
          fps: Math.round(1000 / avg),
          frameTime: Math.round(avg * 10) / 10,
          uptime: Math.round((now - startTime) / 1000),
          memMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : '-',
        });
        lastEmit = now;
        frames = 0;
        acc = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, []);

  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
  const screenInfo = typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height} @${dpr}x` : '';
  const extVersion = (
    (typeof window !== 'undefined' && (window as unknown as { __mila_ext_version__?: string }).__mila_ext_version__)
    ?? (typeof document !== 'undefined' ? document.cookie.match(/mila_ext_ver=([^;]+)/)?.[1] : null)
    ?? '?.?.?'
  );

  return (
    <div className="space-y-8">
      <section>
        <SectionHeader>Performance</SectionHeader>
        <div className="grid grid-cols-2 gap-4">
          <Stat label="FPS" value={perf.fps} />
          <Stat label="ms / frame" value={perf.frameTime} />
          <Stat label="Uptime" value={fmtUptime(perf.uptime)} />
          <Stat label="RAM (JS heap MB)" value={perf.memMB} />
        </div>
      </section>

      <section>
        <SectionHeader>System</SectionHeader>
        <div className="space-y-3">
          <Row label="Version" value={APP_VERSION} />
          <Row label="Extension" value={extVersion} />
          <Row label="Screen" value={screenInfo} />
          <Row label="User agent" value={typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 40) + '…' : ''} mono />
        </div>
      </section>

      <section>
        <SectionHeader>Actions</SectionHeader>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 text-white rounded-xl text-sm font-medium transition-colors"
            style={{ background: 'var(--mila-accent, #0d9488)' }}
          >
            Refresh system
          </button>
          <button
            type="button"
            onClick={() => {
              const w = window as Window & { caches?: CacheStorage };
              if (w.caches) w.caches.keys().then((keys) => Promise.all(keys.map((k) => w.caches!.delete(k)))).finally(() => w.location.reload());
              else w.location.reload();
            }}
            className="px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ background: 'var(--mila-surface, #f3f4f6)', color: 'var(--mila-textSecondary, #666)' }}
          >
            Clear cache &amp; reload
          </button>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--mila-surface, #f9fafb)' }}>
      <div className="text-2xl font-semibold" style={{ color: 'var(--mila-text, #333)' }}>{value}</div>
      <div className="text-xs mt-1" style={{ color: 'var(--mila-textSecondary, #999)' }}>{label}</div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2">
      <span className="text-sm" style={{ color: 'var(--mila-textSecondary, #666)' }}>{label}</span>
      <span className={`text-sm font-medium ${mono ? 'max-w-[200px] truncate text-right text-xs' : ''}`} style={{ color: mono ? 'var(--mila-textSecondary, #999)' : 'var(--mila-text, #333)' }}>{value}</span>
    </div>
  );
}

// ─── Lights tab ──────────────────────────────────────────────────

const LIGHT_EFFECTS = ['Static', 'Fade', 'Pulse', 'Music sync', 'Breathing', 'Rainbow'] as const;
type LightEffect = (typeof LIGHT_EFFECTS)[number];

function LightsTab() {
  const [ambientBrightness, setAmbientBrightness] = useState(80);
  const [ambientColor, setAmbientColor] = useState('#818cf8');
  const [ambientEffect, setAmbientEffect] = useState<LightEffect>('Static');
  const [autoHeadlights, setAutoHeadlights] = useState(true);
  const [welcomeLights, setWelcomeLights] = useState(true);
  const colorPickerRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-8">
      <section>
        <SectionHeader>Ambient lighting</SectionHeader>
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <span className="text-sm min-w-[80px]" style={{ color: 'var(--mila-textSecondary, #666)' }}>Effect</span>
            <ChoiceGroup options={LIGHT_EFFECTS} value={ambientEffect} onChange={setAmbientEffect} />
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm min-w-[80px]" style={{ color: 'var(--mila-textSecondary, #666)' }}>Color</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="w-8 h-8 rounded-full border border-gray-200 shadow-sm"
                style={{ background: ambientColor }}
                onClick={() => colorPickerRef.current?.click()}
              />
              <input
                ref={colorPickerRef}
                type="color"
                value={ambientColor}
                onChange={(e) => setAmbientColor(e.target.value)}
                className="sr-only"
              />
              <span className="text-sm font-mono" style={{ color: 'var(--mila-text, #333)' }}>{ambientColor}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm min-w-[80px]" style={{ color: 'var(--mila-textSecondary, #666)' }}>Brightness</span>
            <div className="flex-1">
              <Slider value={ambientBrightness} onChange={setAmbientBrightness} vertical={false} />
            </div>
            <span className="text-sm w-10 text-right" style={{ color: 'var(--mila-text, #333)' }}>{ambientBrightness}%</span>
          </div>
        </div>
      </section>

      <section>
        <SectionHeader>Automatic lights</SectionHeader>
        <div className="space-y-5">
          <Toggle
            label="Auto headlights"
            desc="Turn on always"
            value={autoHeadlights}
            onChange={setAutoHeadlights}
          />
        </div>
      </section>

      <section>
        <SectionHeader>Interior</SectionHeader>
        <div className="space-y-5">
          <Toggle
            label="Welcome lights"
            desc="Lights fade on when approaching"
            value={welcomeLights}
            onChange={setWelcomeLights}
          />
        </div>
      </section>
    </div>
  );
}

// ─── Navigation tab ──────────────────────────────────────────────

function NavigationTab() {
  return <PlaceholderTab name="Navigation" />;
}

// ─── Locks tab ───────────────────────────────────────────────────

function LocksTab() {
  const [autoLockDrive, setAutoLockDrive] = useState(true);
  const [autoLockWalk, setAutoLockWalk] = useState(true);
  const [unlockPark, setUnlockPark] = useState(true);
  const [unlockApproach, setUnlockApproach] = useState(false);
  const [lockFeedback, setLockFeedback] = useState(true);
  const [childLocks, setChildLocks] = useState(false);

  return (
    <div className="space-y-8">
      <section>
        <SectionHeader>Automatic lock</SectionHeader>
        <div className="space-y-2">
          <Toggle label="Auto-lock when driving" desc="Lock all doors above 15 km/h" value={autoLockDrive} onChange={setAutoLockDrive} />
          <Toggle label="Walk-away lock" desc="Lock when Bluetooth moves away from vehicle" value={autoLockWalk} onChange={setAutoLockWalk} />
          <Toggle label="Unlock when handbrake" desc="Unlock all doors when handbrake is engaged" value={unlockPark} onChange={setUnlockPark} />
          <Toggle label="Approach unlock" desc="Unlock when approaching with Bluetooth" value={unlockApproach} onChange={setUnlockApproach} />
        </div>
      </section>

      <section>
        <SectionHeader>Central lock</SectionHeader>
        <div className="space-y-2">
          <Toggle label="Lock feedback" desc="Horn chirp + light flash on lock" value={lockFeedback} onChange={setLockFeedback} />
          <Toggle label="Child safety locks" desc="Disable rear door handles from inside" value={childLocks} onChange={setChildLocks} />
        </div>
      </section>
    </div>
  );
}

function PlaceholderTab({ name }: { name: string }) {
  return (
    <>
      <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--mila-text, #333)' }}>{name}</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--mila-textSecondary, #999)' }}>Configure your {name.toLowerCase()} preferences</p>
      <div className="text-base" style={{ color: 'var(--mila-textSecondary, #999)' }}>Nothing here yet.</div>
    </>
  );
}

// ─── Panel ───────────────────────────────────────────────────────

const TAB_COMPONENTS: Record<Tab, () => React.ReactElement> = {
  Controls: () => <PlaceholderTab name="Controls" />,
  Navigation: NavigationTab,
  Locks: LocksTab,
  Lights: LightsTab,
  Display: DisplayTab,
  Software: SoftwareTab,
};

export default function SettingsPanel() {
  const [tab, setTab] = useState<Tab>('Controls');
  const ActiveTab = TAB_COMPONENTS[tab];

  return (
    <div className="w-full h-full flex" style={{ background: 'var(--mila-bg, #fff)' }}>
      <div className="w-56 flex-shrink-0 py-6 flex flex-col gap-1" style={{ borderRight: '1px solid var(--mila-border, #f3f4f6)' }}>
        {TABS.map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="flex items-center gap-4 px-5 py-3.5 mx-3 rounded-xl text-base font-medium transition-colors duration-[var(--anim-duration,0.15s)] text-left hover:bg-gray-50"
              style={{
                color: active ? 'var(--mila-text, #333)' : 'var(--mila-textSecondary, #999)',
                background: active ? 'var(--mila-surface, #f3f4f6)' : 'transparent',
              }}
            >
              {icons[t]}
              {t}
            </button>
          );
        })}
      </div>

      {/* key={tab} restarts the fadeTab animation; tab components are now cheap
          to mount because all persisted state lives in the settings store. */}
      <div key={tab} className="flex-1 py-8 px-10 animate-[fadeTab_0.25s_cubic-bezier(0.16,1,0.3,1)]">
        <ActiveTab />
      </div>
    </div>
  );
}
