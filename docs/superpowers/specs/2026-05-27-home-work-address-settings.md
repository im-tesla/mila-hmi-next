# Home & Work Address Settings

## Summary

Add configurable Home and Work address fields to Settings, and update the SearchBar Home/Work chips to check whether an address is set before navigating.

## Settings (`src/lib/settings.ts`)

- Add `homeAddress: ''` (string) and `workAddress: ''` (string) to `DEFAULTS`
- These are persisted along with all other settings

## SettingsPanel (`src/components/SettingsPanel.tsx`)

- Two text input fields: "Home address" and "Work address"
- Placed in a logical spot (e.g. under Appearance or in a new "Favorites" section)
- Each is a labeled text input using the existing `mila-surface`/`mila-text`/`mila-border` pattern
- Use `useSetting('homeAddress')` and `useSetting('workAddress')`

## SearchBar (`src/components/map/SearchBar.tsx`)

- Read `homeAddress` and `workAddress` from settings via DOM CSS custom properties (consistent with the existing `readThemeColors` approach) or via `useSetting`
- On Home/Work chip tap:
  - If address is empty → `showToast("Set your Home address in Settings first")`
  - If address is non-empty → geocode it with `fetchSuggestions`, select first result via `onSelectResult`
- Keep the existing icon-only chip layout

## Not in scope
- "Set to current GPS location" button
- Reverse geocoding
- Any map UI changes beyond the toast message
