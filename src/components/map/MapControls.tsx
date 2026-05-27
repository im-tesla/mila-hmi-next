'use client';

import type mapboxgl from 'mapbox-gl';
import { Plus, Minus, Crosshair } from 'lucide-react';

interface MapControlsProps {
  map: mapboxgl.Map | null;
  userPosRef: React.RefObject<[number, number] | null>;
  navigating?: boolean;
}

export default function MapControls({ map, userPosRef, navigating = false }: MapControlsProps) {
  const handleZoomIn = () => map?.zoomIn({ duration: 300 });
  const handleZoomOut = () => map?.zoomOut({ duration: 300 });

  const handleRecenter = () => {
    if (!map) return;
    const zoom = navigating ? 19 : 15;

    const pos = userPosRef.current;
    if (pos) {
      map.flyTo({ center: pos, zoom, duration: 1200 });
      return;
    }

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          map.flyTo({
            center: [p.coords.longitude, p.coords.latitude],
            zoom,
            duration: 1200,
          });
        },
        () => {
          map.flyTo({ center: [21.01, 52.23], zoom: 12, duration: 1200 });
        },
        { enableHighAccuracy: true, timeout: 8000 },
      );
    }
  };

  const iconColor = 'var(--mila-textSecondary, #999)';
  const btnClass =
    'w-11 h-11 rounded-xl flex items-center justify-center border-0 cursor-pointer';
  const btnStyle: React.CSSProperties = {
    background: 'var(--mila-surface, #2a2a2a)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid var(--mila-border, #333)',
    transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
  };

  return (
    <div
      className="absolute flex flex-col gap-2 z-10"
      style={{ top: '50%', right: 16, transform: 'translateY(-50%)' }}
    >
      <button type="button" className={btnClass} style={btnStyle} onClick={handleZoomIn} aria-label="Zoom in">
        <Plus size={20} color={iconColor} strokeWidth={2} />
      </button>
      <button type="button" className={btnClass} style={btnStyle} onClick={handleZoomOut} aria-label="Zoom out">
        <Minus size={20} color={iconColor} strokeWidth={2} />
      </button>
      <button type="button" className={btnClass} style={btnStyle} onClick={handleRecenter} aria-label="Recenter">
        <Crosshair size={20} color={iconColor} strokeWidth={2} />
      </button>
    </div>
  );
}
