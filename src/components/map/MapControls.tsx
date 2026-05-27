'use client';

import type mapboxgl from 'mapbox-gl';
import { Plus, Minus, Crosshair } from 'lucide-react';

interface MapControlsProps {
  map: mapboxgl.Map | null;
}

export default function MapControls({ map }: MapControlsProps) {
  const handleZoomIn = () => map?.zoomIn({ duration: 300 });
  const handleZoomOut = () => map?.zoomOut({ duration: 300 });

  const handleRecenter = () => {
    if (!map) return;
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          map.flyTo({
            center: [pos.coords.longitude, pos.coords.latitude],
            zoom: 14,
            duration: 1200,
          });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000 },
      );
    }
  };

  const btnClass =
    'w-10 h-10 rounded-xl flex items-center justify-center border-0 cursor-pointer transition-transform duration-[0.25s] ease-[cubic-bezier(0.16,1,0.3,1)]';
  const btnStyle: React.CSSProperties = {
    background: 'rgba(20,20,20,0.85)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
  };

  return (
    <div
      className="absolute flex flex-col gap-2 z-10"
      style={{ top: '50%', right: 16, transform: 'translateY(-50%)' }}
    >
      <button type="button" className={btnClass} style={btnStyle} onClick={handleZoomIn} aria-label="Zoom in">
        <Plus size={18} stroke="rgba(255,255,255,0.7)" strokeWidth={2} />
      </button>
      <button type="button" className={btnClass} style={btnStyle} onClick={handleZoomOut} aria-label="Zoom out">
        <Minus size={18} stroke="rgba(255,255,255,0.7)" strokeWidth={2} />
      </button>
      <button type="button" className={btnClass} style={btnStyle} onClick={handleRecenter} aria-label="Recenter">
        <Crosshair size={18} stroke="rgba(255,255,255,0.7)" strokeWidth={2} />
      </button>
    </div>
  );
}
