'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Fuel, UtensilsCrossed, ShoppingBag, X, MapPin } from 'lucide-react';
import { fetchSuggestions, fetchPOIs, type SearchResult } from '@/lib/mapbox-geocoding';
import { useToast } from '@/components/Toast';

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
  const textMuted = 'var(--mila-textSecondary, #999)';

  return (
    <div ref={containerRef} className="absolute top-5 left-1/2 z-20" style={{ transform: 'translateX(-50%)' }}>
      <div
        style={{
          width: expanded ? 420 : 380,
          borderRadius: 18,
          overflow: 'hidden',
          background: 'var(--mila-surface, #2c2c2e)',
          boxShadow: '0 2px 16px rgba(0,0,0,0.35), 0 0 0 0.5px var(--mila-border, rgba(255,255,255,0.06))',
          transition: 'box-shadow var(--anim-duration, 0.2s) cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Input row */}
        <div className="flex items-center gap-2.5 px-5 py-3.5">
          <Search size={20} color={textMuted} />
          {expanded ? (
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search places..."
              className="flex-1 bg-transparent border-0 outline-none text-[16px]"
              style={{ color: 'var(--mila-text, #f5f5f7)' }}
              autoFocus
            />
          ) : (
            <span
              className="flex-1 text-[16px] cursor-pointer"
              style={{ color: textMuted }}
              onClick={handleFocus}
            >
              Where to?
            </span>
          )}
          {expanded && (
            <button type="button" onClick={handleClose} className="border-0 bg-transparent cursor-pointer p-0.5">
              <X size={18} color={textMuted} />
            </button>
          )}
        </div>

        {/* Quick chips */}
        {expanded && hasQuickChips && (
          <>
            <div className="mx-5" style={{ borderTop: '1px solid var(--mila-border, rgba(255,255,255,0.06))' }} />
            <div
              className="px-5 pt-3.5 pb-2"
              style={{
                animation: expanded ? 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) both' : undefined,
              }}
            >
              <div className="flex gap-2.5">
                {QUICK_CHIPS.map(({ id, label, Icon, query: chipQuery }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleQuickChip(id, chipQuery)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 border-0 cursor-pointer"
                    style={{
                      background: 'var(--mila-bg, #1c1c1e)',
                      borderRadius: 14,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                      transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), background var(--anim-duration, 0.2s) cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.04)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                  >
                    <div
                      style={{
                        width: 34, height: 34, borderRadius: 10,
                        background: id === 'gas' ? '#ff9f0a' : id === 'food' ? '#ff6b35' : '#34c759',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={18} color="#fff" strokeWidth={2.5} />
                    </div>
                    <span className="text-[14px] font-medium" style={{ color: 'var(--mila-text, #f5f5f7)', lineHeight: 1 }}>
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
          )}

          {/* Divider */}
          {showDropdown && (query.trim() || loading || quickResults.length > 0) && (
            <div className="mx-5" style={{ borderTop: '1px solid var(--mila-border, #333)' }} />
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
                    borderBottom: i < results.length - 1 ? '1px solid var(--mila-border, #333)' : 'none',
                  }}
                >
                  <MapPin size={18} color={textMuted} />
                  <span className="text-[15px] flex-1 truncate" style={{ color: 'var(--mila-text, #f5f5f7)' }}>
                    {r.name}
                  </span>
                  <span className="text-[13px] flex-shrink-0" style={{ color: textMuted }}>
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
                    borderBottom: i < quickResults.length - 1 ? '1px solid var(--mila-border, #333)' : 'none',
                  }}
                >
                  <MapPin size={18} color={textMuted} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] truncate" style={{ color: 'var(--mila-text, #f5f5f7)' }}>{r.name}</div>
                    <div className="text-[13px] truncate" style={{ color: textMuted }}>{r.address}</div>
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
                  borderColor: 'var(--mila-border, #333)',
                  borderTopColor: 'var(--mila-accent, #818cf8)',
                }}
              />
            </div>
          )}
      </div>
    </div>
  );
}

