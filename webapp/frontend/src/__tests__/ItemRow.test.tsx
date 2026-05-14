import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ItemRow } from '../components/ItemRow';
import type { ApiItem } from '../types';

const baseItem: ApiItem = {
  id: 1, name: 'молоко', qty: '1 л', done: false, position: 0,
};

function renderRow(overrides: Partial<Parameters<typeof ItemRow>[0]> = {}) {
  const props = {
    item: baseItem,
    onToggle: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    isLast: true,
    openId: null,
    setOpenId: vi.fn(),
    ...overrides,
  };
  const utils = render(<ItemRow {...props} />);
  return { ...utils, props };
}

describe('ItemRow', () => {
  it('renders name and qty', () => {
    renderRow();
    expect(screen.getByText('молоко')).toBeInTheDocument();
    expect(screen.getByText('1 л')).toBeInTheDocument();
  });

  it('renders without qty when null', () => {
    renderRow({ item: { ...baseItem, qty: null } });
    expect(screen.getByText('молоко')).toBeInTheDocument();
    expect(screen.queryByText('1 л')).not.toBeInTheDocument();
  });

  it('calls onToggle on row click', () => {
    const { props } = renderRow();
    fireEvent.click(screen.getByText('молоко'));
    expect(props.onToggle).toHaveBeenCalledWith(1);
  });

  it('calls onEdit when edit button clicked', () => {
    const { props } = renderRow();
    fireEvent.click(screen.getByText('Изменить'));
    expect(props.onEdit).toHaveBeenCalledWith(baseItem);
  });

  it('calls onDelete when delete button clicked', () => {
    const { props } = renderRow();
    fireEvent.click(screen.getByText('Удалить'));
    expect(props.onDelete).toHaveBeenCalledWith(baseItem);
  });

  it('strikes through done items', () => {
    renderRow({ item: { ...baseItem, done: true } });
    const textEl = screen.getByText('молоко');
    expect(textEl).toHaveStyle({ textDecoration: 'line-through' });
  });

  it('does not strike-through undone items', () => {
    renderRow({ item: { ...baseItem, done: false } });
    const textEl = screen.getByText('молоко');
    expect(textEl).toHaveStyle({ textDecoration: 'none' });
  });
});
