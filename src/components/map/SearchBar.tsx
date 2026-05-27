'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Fuel, UtensilsCrossed, ShoppingBag, X, MapPin } from 'lucide-react';
import { fetchSuggestions, fetchPOIs, type SearchResult } from '@/lib/mapbox-geocoding';
import { useToast } from '@/components/Toast';

const QUICK_CHIPS = [
  { id: 'gas', label: 'Gas', Icon: Fuel, query: 'stacja paliw' },
  { id: 'food', label: 'Fast Food', Icon: UtensilsCrossed, query: 'fast food' },
  { id: 'shops', label: 'Shops', Icon: ShoppingBag, query: 'sklep' },
] as const;

interface SearchBarProps {
  getProximity: () => [number, number];
  onSelectResult: (result: SearchResult) => void;
  onClear: () => void;
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

  // Cancel in-flight request on unmount
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // Fetch autocomplete when user types
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    fetchSuggestions(query.trim(), getProximity(), { signal: controller.signal })
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
  }, [query, getProximity, showToast]);

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

  // Close on outside click
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

  return (
    <div ref={containerRef} className="absolute top-5 left-1/2 z-20" style={{ transform: 'translateX(-50%)' }}>
      {/* Backdrop */}
      {expanded && (
        <div
          className="fixed inset-0 z-[-1]"
          style={{
            background: 'rgba(0,0,0,0.25)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
        />
      )}

      {/* Search card */}
      <div
        style={{
          width: expanded ? 400 : 360,
          background: expanded ? 'rgba(28,28,30,0.95)' : 'rgba(20,20,20,0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: 22,
          border: expanded ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.1)',
          overflow: 'hidden',
          transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1), background 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Input row */}
        <div className="flex items-center gap-2.5 px-5 py-3.5">
          <Search size={18} stroke={expanded ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.35)'} strokeWidth={2} />
          {expanded ? (
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search places..."
              className="flex-1 bg-transparent border-0 outline-none text-white text-[15px] placeholder:text-white/25"
              autoFocus
            />
          ) : (
            <span
              className="flex-1 text-[15px] cursor-pointer"
              style={{ color: 'rgba(255,255,255,0.35)' }}
              onClick={handleFocus}
            >
              Where to?
            </span>
          )}
          {expanded && (
            <button
              type="button"
              onClick={handleClose}
              className="border-0 bg-transparent cursor-pointer p-0.5"
            >
              <X size={16} stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Quick chips (only when no query) */}
        {expanded && hasQuickChips && (
          <div className="px-5 pb-2">
            <div className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Quick search
            </div>
            <div className="flex gap-2.5">
              {QUICK_CHIPS.map(({ id, label, Icon, query: chipQuery }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleQuickChip(id, chipQuery)}
                  className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl border-0 cursor-pointer transition-transform duration-[0.2s] ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = 'scale(1.03)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                  }}
                >
                  <Icon size={20} stroke="rgba(255,255,255,0.6)" strokeWidth={1.5} />
                  <span className="text-white text-[13px] font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Divider */}
        {showDropdown && (query.trim() || loading || quickResults.length > 0) && (
          <div className="mx-5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
        )}

        {/* Autocomplete results */}
        {showDropdown && !loading && query.trim() && results.length > 0 && (
          <div>
            {results.map((r, i) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleSelect(r)}
                className="w-full flex items-center gap-3 px-5 py-3.5 border-0 bg-transparent cursor-pointer text-left hover:bg-white/[0.04] transition-colors"
                style={{ borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
              >
                <MapPin size={16} stroke="rgba(255,255,255,0.35)" strokeWidth={2} />
                <span className="text-white text-[14px] flex-1 truncate">{r.name}</span>
                <span className="text-white/25 text-[12px] flex-shrink-0">{r.address.split(',').slice(-2).join(',').trim()}</span>
              </button>
            ))}
          </div>
        )}

        {/* Quick route POI results */}
        {showDropdown && quickResults.length > 0 && (
          <div>
            {quickResults.map((r, i) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleSelect(r)}
                className="w-full flex items-center gap-3 px-5 py-3.5 border-0 bg-transparent cursor-pointer text-left hover:bg-white/[0.04] transition-colors"
                style={{ borderBottom: i < quickResults.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
              >
                <MapPin size={16} stroke="rgba(255,255,255,0.35)" strokeWidth={2} />
                <div className="flex-1 min-w-0">
                  <div className="text-white text-[14px] truncate">{r.name}</div>
                  <div className="text-white/25 text-[12px] truncate">{r.address}</div>
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
                borderColor: 'rgba(255,255,255,0.1)',
                borderTopColor: 'rgba(255,255,255,0.4)',
              }}
            />
          </div>
        )}

        {/* Empty state for quick search */}
        {showDropdown && !loading && quickResults.length === 0 && !query.trim() && hasQuickChips && (
          <div className="text-center py-6 text-white/20 text-[13px]">
            Select a category to find nearby places
          </div>
        )}
      </div>
    </div>
  );
}
