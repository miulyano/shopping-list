import { T } from '../theme';

export interface PrimaryStyle {
  background: string;
  color: string;
  border: string;
}

// Primary CTA style — tinted blue in light theme, solid inverse in dark.
export function usePrimary(): PrimaryStyle {
  if (T.dark) {
    return { background: T.text, color: T.inverseFg, border: 'none' };
  }
  return { background: 'rgba(0,122,255,0.14)', color: T.blue, border: 'none' };
}
