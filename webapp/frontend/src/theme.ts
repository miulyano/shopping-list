import { useSyncExternalStore } from 'react';

export interface Theme {
  bg: string;
  card: string;
  text: string;
  text2: string;
  text3: string;
  sep: string;
  accent: string;
  accentBg: string;
  blue: string;
  red: string;
  tgHeader: string;
  pageBg: string;
  surfaceBg: string;
  pillBg: string;
  inverseFg: string;
  dark: boolean;
}

const LIGHT: Omit<Theme, 'dark'> = {
  bg:        '#F2F2F7',
  card:      '#FFFFFF',
  text:      '#000000',
  text2:     'rgba(60,60,67,0.60)',
  text3:     'rgba(60,60,67,0.30)',
  sep:       'rgba(60,60,67,0.10)',
  accent:    '#34C759',
  accentBg:  'rgba(52,199,89,0.12)',
  blue:      '#007AFF',
  red:       '#FF3B30',
  tgHeader:  '#F7F7F7',
  pageBg:    '#E8E8EC',
  surfaceBg: 'rgba(247,247,247,0.92)',
  pillBg:    'rgba(120,120,128,0.12)',
  inverseFg: '#FFFFFF',
};

const DARK: Omit<Theme, 'dark'> = {
  bg:        '#000000',
  card:      '#1C1C1E',
  text:      '#FFFFFF',
  text2:     'rgba(235,235,245,0.60)',
  text3:     'rgba(235,235,245,0.30)',
  sep:       'rgba(84,84,88,0.45)',
  accent:    '#30D158',
  accentBg:  'rgba(48,209,88,0.18)',
  blue:      '#0A84FF',
  red:       '#FF453A',
  tgHeader:  '#1C1C1E',
  pageBg:    '#0A0A0B',
  surfaceBg: 'rgba(28,28,30,0.92)',
  pillBg:    'rgba(120,120,128,0.24)',
  inverseFg: '#000000',
};

// Module-level mutable theme object. Mirrors the legacy `const T = {...}` pattern
// from the pre-Vite Mini App so component code can read `T.bg` etc. directly
// without subscribing per-component. Re-renders are driven by a separate version
// counter via useSyncExternalStore.
export const T: Theme = { ...LIGHT, dark: false };

let version = 0;
const listeners = new Set<() => void>();

export function applyTheme(dark: boolean): void {
  Object.assign(T, dark ? DARK : LIGHT);
  T.dark = !!dark;
  document.body.setAttribute('data-theme', dark ? 'dark' : 'light');
  version++;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): number {
  return version;
}

/**
 * Subscribe a single component (the App root) to theme changes. Internally
 * tracks a version counter — the returned `T` object reference is stable but
 * its fields are mutated in place by `applyTheme`. Re-renders cascade from the
 * subscribed root through the tree, so nested components can keep reading
 * `T.bg`, `T.text`, etc. without each one calling `useTheme`.
 */
export function useTheme(): Theme {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return T;
}
