import { describe, expect, it } from 'vitest';
import { fmtDate, fmtDateTime, fmtDateTimeCaps, pad2, pluralRu } from '../lib/format';

describe('pluralRu', () => {
  const forms: [string, string, string] = ['товар', 'товара', 'товаров'];

  it('singular for 1, 21, 31', () => {
    expect(pluralRu(1, forms)).toBe('товар');
    expect(pluralRu(21, forms)).toBe('товар');
    expect(pluralRu(31, forms)).toBe('товар');
  });

  it('few for 2-4, 22-24', () => {
    expect(pluralRu(2, forms)).toBe('товара');
    expect(pluralRu(3, forms)).toBe('товара');
    expect(pluralRu(4, forms)).toBe('товара');
    expect(pluralRu(22, forms)).toBe('товара');
    expect(pluralRu(24, forms)).toBe('товара');
  });

  it('many for 5-20, 25, 100', () => {
    expect(pluralRu(0, forms)).toBe('товаров');
    expect(pluralRu(5, forms)).toBe('товаров');
    expect(pluralRu(11, forms)).toBe('товаров');
    expect(pluralRu(12, forms)).toBe('товаров');
    expect(pluralRu(14, forms)).toBe('товаров');
    expect(pluralRu(20, forms)).toBe('товаров');
    expect(pluralRu(25, forms)).toBe('товаров');
    expect(pluralRu(100, forms)).toBe('товаров');
  });
});

describe('pad2', () => {
  it('pads single digit', () => expect(pad2(7)).toBe('07'));
  it('keeps two digit', () => expect(pad2(42)).toBe('42'));
  it('zero', () => expect(pad2(0)).toBe('00'));
});

describe('fmtDate', () => {
  it('renders ru month name', () => {
    expect(fmtDate(new Date(2026, 0, 15))).toBe('15 января');
    expect(fmtDate(new Date(2026, 4, 1))).toBe('1 мая');
    expect(fmtDate(new Date(2026, 11, 31))).toBe('31 декабря');
  });
});

describe('fmtDateTime', () => {
  it('renders date + HH:MM', () => {
    expect(fmtDateTime(new Date(2026, 4, 14, 9, 5))).toBe('14 мая, 9:05');
    expect(fmtDateTime(new Date(2026, 4, 14, 23, 59))).toBe('14 мая, 23:59');
  });
});

describe('fmtDateTimeCaps', () => {
  it('uppercases output', () => {
    expect(fmtDateTimeCaps(new Date(2026, 4, 14, 12, 0))).toBe('14 МАЯ, 12:00');
  });
});
