import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { EditSheet } from '../components/EditSheet';
import type { ApiItem } from '../types';

const item: ApiItem = { id: 1, name: 'молоко', qty: '1 л', done: false, position: 0 };

describe('EditSheet', () => {
  it('renders prefilled name and qty inputs', () => {
    render(<EditSheet item={item} onClose={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByDisplayValue('молоко')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1 л')).toBeInTheDocument();
  });

  it('renders nothing when item is null', () => {
    const { container } = render(<EditSheet item={null} onClose={vi.fn()} onSave={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('saves trimmed name and qty', () => {
    const onSave = vi.fn();
    render(<EditSheet item={item} onClose={vi.fn()} onSave={onSave} />);
    fireEvent.change(screen.getByDisplayValue('молоко'), { target: { value: '  хлеб  ' } });
    fireEvent.change(screen.getByDisplayValue('1 л'), { target: { value: '  ' } });
    fireEvent.click(screen.getByText('Готово'));
    expect(onSave).toHaveBeenCalledWith({ ...item, name: 'хлеб', qty: null });
  });

  it('does not save when name is blank', () => {
    const onSave = vi.fn();
    render(<EditSheet item={item} onClose={vi.fn()} onSave={onSave} />);
    fireEvent.change(screen.getByDisplayValue('молоко'), { target: { value: '   ' } });
    fireEvent.click(screen.getByText('Готово'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves on Enter key in name input', () => {
    const onSave = vi.fn();
    render(<EditSheet item={item} onClose={vi.fn()} onSave={onSave} />);
    const nameInput = screen.getByDisplayValue('молоко');
    fireEvent.change(nameInput, { target: { value: 'яйца' } });
    fireEvent.keyDown(nameInput, { key: 'Enter' });
    expect(onSave).toHaveBeenCalled();
  });

  it('calls onClose when Отмена clicked', () => {
    const onClose = vi.fn();
    render(<EditSheet item={item} onClose={onClose} onSave={vi.fn()} />);
    fireEvent.click(screen.getByText('Отмена'));
    expect(onClose).toHaveBeenCalled();
  });
});
