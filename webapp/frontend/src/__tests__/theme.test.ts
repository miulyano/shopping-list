import { afterEach, describe, expect, it } from 'vitest';
import { T, applyTheme } from '../theme';

afterEach(() => {
  applyTheme(false);
});

describe('applyTheme', () => {
  it('sets body data-theme="dark"', () => {
    applyTheme(true);
    expect(document.body.getAttribute('data-theme')).toBe('dark');
  });

  it('sets body data-theme="light"', () => {
    applyTheme(false);
    expect(document.body.getAttribute('data-theme')).toBe('light');
  });

  it('mutates T to dark palette in place (stable ref)', () => {
    const ref = T;
    applyTheme(true);
    expect(T).toBe(ref); // same module-level reference
    expect(T.bg).toBe('#000000');
    expect(T.card).toBe('#1C1C1E');
    expect(T.text).toBe('#FFFFFF');
    expect(T.accent).toBe('#30D158');
    expect(T.dark).toBe(true);
  });

  it('mutates T to light palette in place', () => {
    applyTheme(false);
    expect(T.bg).toBe('#F2F2F7');
    expect(T.card).toBe('#FFFFFF');
    expect(T.text).toBe('#000000');
    expect(T.accent).toBe('#34C759');
    expect(T.dark).toBe(false);
  });

  it('round-trips: dark → light → dark', () => {
    applyTheme(true);
    applyTheme(false);
    expect(T.bg).toBe('#F2F2F7');
    applyTheme(true);
    expect(T.bg).toBe('#000000');
  });
});
