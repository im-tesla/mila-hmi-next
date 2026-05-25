'use client';

import { useSyncExternalStore } from 'react';

export interface CustomApp {
  id: string;
  name: string;
  url: string;
  color?: string;
  faviconUrl?: string;
}

const STORAGE_KEY = 'mila:custom-apps/v1';

function load(): CustomApp[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a: unknown) =>
        a && typeof a === 'object' &&
        typeof (a as CustomApp).id === 'string' &&
        typeof (a as CustomApp).name === 'string' &&
        typeof (a as CustomApp).url === 'string',
    );
  } catch {
    return [];
  }
}

let state: CustomApp[] = load();
const listeners = new Set<() => void>();
let savePending = false;

function scheduleSave() {
  if (savePending || typeof window === 'undefined') return;
  savePending = true;
  setTimeout(() => {
    savePending = false;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, 0);
}

function notify() {
  listeners.forEach((fn) => fn());
}

export function getCustomApps(): CustomApp[] {
  return state;
}

export function normalizeUrl(input: string): string {
  let s = input.trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    if (!u.hostname.includes('.')) return '';
    return u.origin + u.pathname.replace(/\/$/, '') + u.search + u.hash;
  } catch {
    return '';
  }
}

export function getFaviconUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return `https://${hostname}/favicon.ico`;
  } catch {
    return '';
  }
}

export function getFaviconFallback(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
  } catch {
    return '';
  }
}

export function extractFaviconColor(imageUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const settled = false;
    const done = (color: string | null) => {
      if ((img as any).__done) return;
      (img as any).__done = true;
      resolve(color);
    };
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) { done(null); return; }
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          // skip fully transparent pixels
          if (data[i + 3] < 128) continue;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
        if (count === 0) { done(null); return; }
        const hex = '#' + [r / count, g / count, b / count]
          .map((v) => Math.round(v).toString(16).padStart(2, '0'))
          .join('');
        done(hex);
      } catch {
        done(null);
      }
    };
    img.onerror = () => done(null);
    img.src = imageUrl;
  });
}

export async function resolveFaviconUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/favicon?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.faviconUrl || null;
  } catch {
    return null;
  }
}

export function addCustomApp(name: string, url: string, color?: string, faviconUrl?: string): CustomApp | null {
  const trimmedName = name.trim();
  if (!trimmedName) return null;
  const normalized = normalizeUrl(url);
  if (!normalized) return null;
  if (state.some((a) => a.url === normalized)) return null;
  const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const app: CustomApp = { id, name: trimmedName, url: normalized, color, faviconUrl };
  state = [...state, app];
  scheduleSave();
  notify();
  return app;
}

export function removeCustomApp(id: string): void {
  const idx = state.findIndex((a) => a.id === id);
  if (idx === -1) return;
  state = [...state.slice(0, idx), ...state.slice(idx + 1)];
  scheduleSave();
  notify();
}

export function subscribeCustomApps(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

const EMPTY: CustomApp[] = [];

export function useCustomApps(): CustomApp[] {
  return useSyncExternalStore(
    subscribeCustomApps,
    getCustomApps,
    () => EMPTY,
  );
}
