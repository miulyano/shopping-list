import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { getStartList } from '../lib/telegram';
import { ListTabs } from '../components/ListTabs';
import { MoveSheet } from '../components/MoveSheet';
import { mockWebApp } from '../test-setup';
import type { ApiItem, NamedList } from '../types';

const LISTS: NamedList[] = [
  { id: 1, key: 'general', name: 'Общее', color: '#30B0C7', position: 0, is_default: true },
  { id: 2, key: 'tata', name: 'Тата', color: '#FF4FA6', position: 1, is_default: false },
  { id: 3, key: 'maksim', name: 'Максим', color: '#AF52DE', position: 2, is_default: false },
];

afterEach(() => {
  mockWebApp.initDataUnsafe = undefined;
  window.location.hash = '';
});

describe('getStartList', () => {
  it('reads start_param (list-<key>)', () => {
    mockWebApp.initDataUnsafe = { start_param: 'list-tata' };
    expect(getStartList()).toBe('tata');
  });

  it('reads location.hash (#list=<key>)', () => {
    window.location.hash = '#list=maksim';
    expect(getStartList()).toBe('maksim');
  });

  it('returns null when no list requested', () => {
    expect(getStartList()).toBeNull();
  });
});

describe('ListTabs', () => {
  it('renders one button per list and fires onChange', () => {
    const onChange = vi.fn();
    render(<ListTabs lists={LISTS} activeId={1} onChange={onChange} />);
    expect(screen.getByText('Общее')).toBeInTheDocument();
    expect(screen.getByText('Тата')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Максим'));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('renders nothing for a single list', () => {
    const { container } = render(<ListTabs lists={LISTS.slice(0, 1)} activeId={1} onChange={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('MoveSheet', () => {
  const item: ApiItem = {
    id: 10, name: 'молоко', qty: '1 л', done: false, position: 0,
    category: 'food', named_list_id: 1,
  };

  it('moves the item to the picked list on Готово', () => {
    const onMove = vi.fn();
    render(<MoveSheet item={item} lists={LISTS} onClose={vi.fn()} onMove={onMove} />);
    fireEvent.click(screen.getByText('Тата'));
    fireEvent.click(screen.getByText('Готово'));
    expect(onMove).toHaveBeenCalledWith(10, 2);
  });
});
