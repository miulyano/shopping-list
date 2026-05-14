type TgEvent = 'themeChanged' | 'fullscreenFailed';

export interface TelegramWebApp {
  readonly initData: string;
  readonly platform: string;
  readonly colorScheme: 'light' | 'dark';
  readonly isFullscreen?: boolean;
  isVersionAtLeast(v: string): boolean;
  ready(): void;
  expand(): void;
  close(): void;
  disableVerticalSwipes?(): void;
  requestFullscreen?(): void;
  onEvent(event: TgEvent, cb: (e?: { error?: string }) => void): void;
  offEvent(event: TgEvent, cb: (e?: { error?: string }) => void): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

const MOBILE_PLATFORMS = new Set(['android', 'android_x', 'ios']);

export const tg: TelegramWebApp | null =
  typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp
    ? window.Telegram.WebApp
    : null;

export function isMobileTg(t: TelegramWebApp | null): boolean {
  return !!t && MOBILE_PLATFORMS.has(t.platform);
}

export function atLeast(t: TelegramWebApp | null, version: string): boolean {
  return !!t && typeof t.isVersionAtLeast === 'function' && t.isVersionAtLeast(version);
}

export function lockMiniApp(t: TelegramWebApp | null): void {
  if (!t) return;
  t.ready();
  t.expand();
  if (!isMobileTg(t)) return;
  if (atLeast(t, '7.7') && typeof t.disableVerticalSwipes === 'function') {
    try {
      t.disableVerticalSwipes();
    } catch {
      // swallow — older TG clients may throw
    }
  }
  if (atLeast(t, '8.0') && typeof t.requestFullscreen === 'function' && !t.isFullscreen) {
    try {
      t.requestFullscreen();
    } catch {
      // swallow — fullscreen may be disallowed
    }
    if (typeof t.onEvent === 'function') {
      t.onEvent('fullscreenFailed', (e) => {
        console.warn('[tg] fullscreenFailed', e && e.error);
      });
    }
  }
}

export function closeApp(): void {
  if (tg) tg.close();
}
