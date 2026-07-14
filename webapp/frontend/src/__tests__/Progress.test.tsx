import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Progress } from '../components/Progress';

describe('Progress — «Убрать купленное»', () => {
  it('shown when partially bought', () => {
    render(<Progress done={1} total={3} onArchivePurchased={vi.fn()}/>);
    expect(screen.getByText('Убрать купленное')).toBeTruthy();
  });

  it('shown when all bought and settled (manual escape hatch)', () => {
    render(<Progress done={3} total={3} onArchivePurchased={vi.fn()}/>);
    expect(screen.getByText('Убрать купленное')).toBeTruthy();
  });

  it('hidden when all bought but a toggle/auto-archive is still settling', () => {
    render(<Progress done={3} total={3} settling onArchivePurchased={vi.fn()}/>);
    expect(screen.queryByText('Убрать купленное')).toBeNull();
  });

  it('still shown when partially bought while settling', () => {
    render(<Progress done={1} total={3} settling onArchivePurchased={vi.fn()}/>);
    expect(screen.getByText('Убрать купленное')).toBeTruthy();
  });

  it('hidden when nothing bought', () => {
    render(<Progress done={0} total={3} onArchivePurchased={vi.fn()}/>);
    expect(screen.queryByText('Убрать купленное')).toBeNull();
  });

  it('hidden without handler', () => {
    render(<Progress done={2} total={3}/>);
    expect(screen.queryByText('Убрать купленное')).toBeNull();
  });
});
