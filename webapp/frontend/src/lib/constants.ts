import { isMobileTg, tg } from './telegram';

export const SF =
  '-apple-system, "SF Pro Text", "SF Pro Display", system-ui, sans-serif';

export const TOP_INSET = isMobileTg(tg) ? 64 : 20;
