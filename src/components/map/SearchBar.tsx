'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Fuel, UtensilsCrossed, ShoppingBag, X, MapPin, Home, Briefcase } from 'lucide-react';
import { fetchSuggestions, fetchPOIs, type SearchResult } from '@/lib/mapbox-geocoding';
import { useToast } from '@/components/Toast';
import { useSetting } from '@/lib/settings';

type ThemeColors = { bg: string; surface: string; text: string; textSecondary: string; accent: string; border: string };

const FALLBACK: ThemeColors = { bg: '#1a1a1a', surface: '#2a2a2a', text: '#f5f5f7', textSecondary: '#999999', accent: '#818cf8', border: '#333333' };

function readThemeColors(): ThemeColors {
  if (typeof document === 'undefined') return FALLBACK;
  const s = getComputedStyle(document.documentElement);
  const v = (name: string) => s.getPropertyValue(name).trim();
  return {
    bg: v('--mila-bg') || FALLBACK.bg,
    surface: v('--mila-surface') || FALLBACK.surface,
    text: v('--mila-text') || FALLBACK.text,
    textSecondary: v('--mila-textSecondary') || FALLBACK.textSecondary,
    accent: v('--mila-accent') || FALLBACK.accent,
    border: v('--mila-border') || FALLBACK.border,
  };
}

const FAVORITES = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'work', label: 'Work', Icon: Briefcase },
] as const;

const QUICK_CHIPS = [
  { id: 'gas', label: 'Gas', Icon: Fuel, query: 'gas station' },
  { id: 'food', label: 'Fast Food', Icon: UtensilsCrossed, query: 'fast food' },
  { id: 'shops', label: 'Shops', Icon: ShoppingBag, query: 'grocery store' },
] as const;

interface SearchBarProps {
  getProximity: () => [number, number];
  onSelectResult: (result: SearchResult) => void;
  onClear: () => void;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function SearchBar({ getProximity, onSelectResult, onClear }: SearchBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [quickResults, setQuickResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { show: showToast } = useToast();

  const [colors, setColors] = useState<ThemeColors>(FALLBACK);

  useEffect(() => {
    setColors(readThemeColors());
    const mo = new MutationObserver(() => setColors(readThemeColors()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    return () => mo.disconnect();
  }, []);

  const [homeAddress] = useSetting('homeAddress');
  const [workAddress] = useSetting('workAddress');

  const debouncedQuery = useDebounce(query.trim(), 300);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // Fetch autocomplete on debounced query
  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    fetchSuggestions(debouncedQuery, getProximity(), { signal: controller.signal })
      .then((r) => {
        if (!controller.signal.aborted) setResults(r);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        if (!controller.signal.aborted) showToast('Search is unavailable right now.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  }, [debouncedQuery, getProximity, showToast]);

  const handleQuickChip = useCallback(
    (id: string, chipQuery: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setQuickResults([]);

      fetchPOIs(chipQuery, getProximity(), { signal: controller.signal })
        .then((r) => {
          if (!controller.signal.aborted) setQuickResults(r);
        })
        .catch((err) => {
          if (err.name === 'AbortError') return;
          if (!controller.signal.aborted) showToast('Search is unavailable right now.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    },
    [getProximity, showToast],
  );

  const handleFavorite = useCallback(
    (id: string, label: string) => {
      const addr = id === 'home' ? homeAddress : workAddress;
      if (!addr.trim()) {
        showToast(`Set your ${label} address in Settings first`);
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setQuickResults([]);

      fetchSuggestions(addr, getProximity(), { signal: controller.signal })
        .then((r) => {
          if (!controller.signal.aborted && r.length > 0) {
            setQuickResults(r);
          } else if (!controller.signal.aborted) {
            showToast(`Couldn't find your ${label} address`);
          }
        })
        .catch((err) => {
          if (err.name === 'AbortError') return;
          if (!controller.signal.aborted) showToast('Search is unavailable right now.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    },
    [getProximity, homeAddress, workAddress, showToast],
  );

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setExpanded(false);
      setQuery('');
      setResults([]);
      setQuickResults([]);
      onSelectResult(result);
    },
    [onSelectResult],
  );

  const handleClose = useCallback(() => {
    setExpanded(false);
    setQuery('');
    setResults([]);
    setQuickResults([]);
    onClear();
  }, [onClear]);

  const handleFocus = useCallback(() => {
    setExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const onDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [expanded, handleClose]);

  const showDropdown = expanded;
  const hasQuickChips = !query.trim();

  const chipColor = (id: string) => (id === 'gas' ? '#ff9f0a' : id === 'food' ? '#ff6b35' : '#34c759');

  return (
    <div ref={containerRef} className="absolute top-5 left-1/2 z-20" style={{ transform: 'translateX(-50%)' }}>
      <div
        style={{
          width: expanded ? 400 : 360,
          borderRadius: 18,
          overflow: 'hidden',
          background: colors.surface,
          boxShadow: `0 2px 16px rgba(0,0,0,0.35), 0 0 0 0.5px ${colors.border}`,
          transition: 'box-shadow var(--anim-duration, 0.2s) cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-5 py-4">
          <Search size={22} color={colors.textSecondary} />
          {expanded ? (
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search places..."
              className="flex-1 bg-transparent border-0 outline-none text-[17px]"
              style={{ color: colors.text }}
              autoFocus
            />
          ) : (
            <span
              className="flex-1 text-[17px] cursor-pointer"
              style={{ color: colors.textSecondary }}
              onClick={handleFocus}
            >
              Where to?
            </span>
          )}
          {expanded && (
            <button type="button" onClick={handleClose} className="border-0 bg-transparent cursor-pointer p-0.5">
              <X size={20} color={colors.textSecondary} />
            </button>
          )}
        </div>

        {/* Quick chips */}
        {expanded && hasQuickChips && (
          <>
            <div className="mx-5" style={{ borderTop: `1px solid ${colors.border}` }} />
            <div
              className="px-5 py-3"
              style={{
                animation: 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) both',
              }}
            >
              <div className="flex justify-center gap-3">
                {FAVORITES.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleFavorite(id, label)}
                    aria-label={label}
                    className="flex items-center justify-center border-0 cursor-pointer"
                    style={{
                      width: 56, height: 56,
                      background: id === 'home' ? '#3b82f6' : '#6366f1',
                      borderRadius: 16,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.06)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                  >
                    <Icon size={24} color="#fff" strokeWidth={2.5} />
                  </button>
                ))}
                {QUICK_CHIPS.map(({ id, label, Icon, query: chipQuery }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleQuickChip(id, chipQuery)}
                    aria-label={label}
                    className="flex items-center justify-center border-0 cursor-pointer"
                    style={{
                      width: 56, height: 56,
                      background: chipColor(id),
                      borderRadius: 16,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.06)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                  >
                    <Icon size={24} color="#fff" strokeWidth={2.5} />
                  </button>
                ))}
              </div>
            </div>
          </>
          )}

          {/* Divider */}
          {showDropdown && (query.trim() || loading || quickResults.length > 0) && (
            <div className="mx-5" style={{ borderTop: `1px solid ${colors.border}` }} />
          )}

          {/* Autocomplete results */}
          {showDropdown && debouncedQuery && results.length > 0 && (
            <div
              style={{
                animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) both',
              }}
            >
              {results.map((r, i) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleSelect(r)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 border-0 bg-transparent cursor-pointer text-left"
                  style={{
                    borderBottom: i < results.length - 1 ? `1px solid ${colors.border}` : 'none',
                  }}
                >
                  <MapPin size={20} color={colors.textSecondary} />
                  <span className="text-[16px] flex-1 truncate" style={{ color: colors.text }}>
                    {r.name}
                  </span>
                  <span className="text-[13px] flex-shrink-0" style={{ color: colors.textSecondary }}>
                    {r.address.split(',').slice(-2).join(',').trim()}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Quick route POI results */}
          {showDropdown && quickResults.length > 0 && (
            <div
              style={{
                animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) both',
              }}
            >
              {quickResults.map((r, i) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleSelect(r)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 border-0 bg-transparent cursor-pointer text-left"
                  style={{
                    borderBottom: i < quickResults.length - 1 ? `1px solid ${colors.border}` : 'none',
                  }}
                >
                  <MapPin size={20} color={colors.textSecondary} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[16px] truncate" style={{ color: colors.text }}>{r.name}</div>
                    <div className="text-[13px] truncate" style={{ color: colors.textSecondary }}>{r.address}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-5">
              <div
                className="w-5 h-5 border-2 rounded-full animate-spin"
                style={{
                  borderColor: colors.border,
                  borderTopColor: colors.accent,
                }}
              />
            </div>
          )}
      </div>
    </div>
  );
}

