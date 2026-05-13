export const getMapConfig = (k: string, def: boolean): boolean => {
  try { const v = localStorage.getItem(k); return v === null ? def : v !== '0'; } catch (_) { return def; }
};

export const setMapConfig = (k: string, v: boolean): void => {
  try { localStorage.setItem(k, v ? '1' : '0'); } catch (_) {}
};
