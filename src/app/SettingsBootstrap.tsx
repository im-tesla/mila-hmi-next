'use client';

import { useEffect } from 'react';
import { initSettingsEffects } from '@/lib/settings';

// Mounts once near the root and applies persisted theme/scale/animation
// values to the documentElement. Replaces the per-component restore logic
// that was previously duplicated across page.tsx and SettingsPanel.tsx.
export default function SettingsBootstrap() {
  useEffect(() => {
    initSettingsEffects();
  }, []);
  return null;
}
