import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConfirmSheet } from '../components/ConfirmSheet';

describe('ConfirmSheet', () => {
  it('renders title, desc and confirm label', () => {
    render(<ConfirmSheet
      title="Удалить?"
      desc="Это безвозвратно."
      confirmLabel="Удалить"
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
    />);
    expect(screen.getByText('Удалить?')).toBeInTheDocument();
    expect(screen.getByText('Это безвозвратно.')).toBeInTheDocument();
    expect(screen.getByText('Удалить')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn();
    render(<ConfirmSheet title="x" desc="y" confirmLabel="OK" onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('OK'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Отмена clicked', () => {
    const onCancel = vi.fn();
    render(<ConfirmSheet title="x" desc="y" confirmLabel="OK" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Отмена'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when overlay clicked', () => {
    const onCancel = vi.fn();
    const { container } = render(
      <ConfirmSheet title="x" desc="y" confirmLabel="OK" onConfirm={vi.fn()} onCancel={onCancel} />,
    );
    fireEvent.click(container.firstChild as Element);
    expect(onCancel).toHaveBeenCalled();
  });
});
