// Fixed category taxonomy. Mirrors the backend parser CATEGORIES
// (bot/services/parser.py). The list also drives display order: groups render
// top-to-bottom in this sequence, empty groups are skipped.
export interface Category {
  key: string;
  label: string;
}

export const CATEGORIES: Category[] = [
  { key: 'food', label: 'Продукты' },
  { key: 'home', label: 'Бытовые товары' },
  { key: 'care', label: 'Косметика и гигиена' },
];

export const DEFAULT_CATEGORY = 'food';

/** Normalize a possibly-null/legacy category value to a known key. */
export function catKey(category: string | null | undefined): string {
  return CATEGORIES.some((c) => c.key === category) ? (category as string) : DEFAULT_CATEGORY;
}
