'use client';

import { useSyncExternalStore } from 'react';

export type Theme = 'Dark' | 'Light' | 'Cute' | 'Custom';
export type UiScale = 'Small' | 'Normal' | 'Large';
export type PanelSize = 'Normal' | 'Large' | 'Wide';
export type Animations = 'Full' | 'Reduced' | 'Off';

export const UI_SCALES: Record<UiScale, number> = { Small: 1, Normal: 1.15, Large: 1.3 };
export const PANEL_WIDTHS: Record<PanelSize, number> = { Normal: 810, Large: 980, Wide: 1200 };

export type ThemeColors = {
  bg: string;
  surface: string;
  text: string;
  textSecondary: string;
  accent: string;
  border: string;
};

export const THEME_COLORS: Record<Exclude<Theme, 'Custom'>, ThemeColors> = {
  Dark:  { bg: '#1a1a1a', surface: '#2a2a2a', text: '#f5f5f7', textSecondary: '#999999', accent: '#818cf8', border: '#333333' },
  Light: { bg: '#ffffff', surface: '#f5f5f7', text: '#1a1a1a', textSecondary: '#666666', accent: '#0d9488', border: '#e5e5e5' },
  Cute:  { bg: '#fdf2f8', surface: '#fce7f3', text: '#831843', textSecondary: '#9d174d', accent: '#db2777', border: '#fbcfe8' },
};

export const DEFAULT_CUSTOM_COLORS: ThemeColors = {
  bg: '#1a1a1a', surface: '#2a2a2a', text: '#f5f5f7',
  textSecondary: '#999999', accent: '#007aff', border: '#333333',
};

const DEFAULTS = {
  theme: 'Light' as Theme,
  customColors: DEFAULT_CUSTOM_COLORS,
  uiScale: 'Normal' as UiScale,
  panelSize: 'Normal' as PanelSize,
  animations: 'Full' as Animations,
  mapStyle: 'mapbox://styles/mapbox/streets-v12',
  mbRoadLabels: true,
  mbPoiLabels: true,
  mbTransitLabels: true,
  mb3dBuildings: true,
  mbPoliceAlerts: true,
  mbDucking: true,
};

export type Settings = typeof DEFAULTS;
export type SettingKey = keyof Settings;

const STORAGE_KEY = 'mila:settings/v1';

function load(): Settings {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

let state: Settings = load();
const listeners: { [K in SettingKey]?: Set<() => void> } = {};
let savePending = false;

function scheduleSave() {
  if (savePending || typeof window === 'undefined') return;
  savePending = true;
  // Defer the localStorage write off the render path. Sync localStorage can
  // stutter several ms on slow flash; for a 60 Hz HMI that's a missed frame.
  setTimeout(() => {
    savePending = false;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, 0);
}

export function getSetting<K extends SettingKey>(key: K): Settings[K] {
  return state[key];
}

export function setSetting<K extends SettingKey>(key: K, value: Settings[K]): void {
  if (state[key] === value) return;
  state = { ...state, [key]: value };
  scheduleSave();
  listeners[key]?.forEach((fn) => fn());
}

export function subscribeSetting<K extends SettingKey>(key: K, fn: () => void): () => void {
  let bucket = listeners[key];
  if (!bucket) { bucket = new Set(); listeners[key] = bucket; }
  bucket.add(fn);
  return () => { bucket!.delete(fn); };
}

export function useSetting<K extends SettingKey>(
  key: K,
): [Settings[K], (v: Settings[K]) => void] {
  const value = useSyncExternalStore(
    (cb) => subscribeSetting(key, cb),
    () => getSetting(key),
    () => DEFAULTS[key],
  );
  return [value, (v: Settings[K]) => setSetting(key, v)];
}

// ─── DOM side effects ────────────────────────────────────────────

function applyTheme(): void {
  const t = state.theme;
  const colors = t === 'Custom' ? state.customColors : THEME_COLORS[t];
  const root = document.documentElement;
  for (const k in colors) {
    root.style.setProperty(`--mila-${k}`, colors[k as keyof ThemeColors]);
  }
}

function applyScale(): void {
  document.documentElement.style.fontSize = `${UI_SCALES[state.uiScale] * 100}%`;
}

function applyAnimations(): void {
  const root = document.documentElement;
  if (state.animations === 'Off') root.style.setProperty('--anim-duration', '0s');
  else if (state.animations === 'Reduced') root.style.setProperty('--anim-duration', '0.15s');
  else root.style.removeProperty('--anim-duration');
}

let effectsInit = false;
export function initSettingsEffects(): void {
  if (effectsInit || typeof document === 'undefined') return;
  effectsInit = true;
  applyTheme();
  applyScale();
  applyAnimations();
  subscribeSetting('theme', applyTheme);
  subscribeSetting('customColors', applyTheme);
  subscribeSetting('uiScale', applyScale);
  subscribeSetting('animations', applyAnimations);
}

// Strict hex color validator: full #rgb or #rrggbb only.
export const isValidHex = (v: string): boolean => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);
