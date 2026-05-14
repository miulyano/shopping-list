import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Stable Telegram WebApp mock — captured at module load by lib/telegram.ts and
// lib/constants.ts (TOP_INSET) and api/client.ts (initData). Mutating it later
// has no effect on those captures, so this represents the "desktop, light theme"
// baseline the test suite assumes.
interface MockWebApp {
  initData: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  isFullscreen: boolean;
  isVersionAtLeast: (v: string) => boolean;
  ready: () => void;
  expand: () => void;
  close: () => void;
  disableVerticalSwipes: () => void;
  requestFullscreen: () => void;
  onEvent: () => void;
  offEvent: () => void;
}

const mockWebApp: MockWebApp = {
  initData: 'test_init_data',
  platform: 'unknown',
  colorScheme: 'light',
  isFullscreen: false,
  isVersionAtLeast: () => false,
  ready: vi.fn(),
  expand: vi.fn(),
  close: vi.fn(),
  disableVerticalSwipes: vi.fn(),
  requestFullscreen: vi.fn(),
  onEvent: vi.fn(),
  offEvent: vi.fn(),
};

(window as unknown as { Telegram?: { WebApp?: MockWebApp } }).Telegram = { WebApp: mockWebApp };

// jsdom does not implement matchMedia
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.unstubAllGlobals();
});

export { mockWebApp };
