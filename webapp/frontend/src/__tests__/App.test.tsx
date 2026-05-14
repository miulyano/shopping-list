import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../App';
import type { ApiItem, ApiState } from '../types';

function mockFetch(handlers: Record<string, () => unknown>) {
  const f = vi.fn().mockImplementation((url: string) => {
    const handler = handlers[url];
    if (!handler) return Promise.reject(new Error(`unexpected fetch: ${url}`));
    return Promise.resolve({ ok: true, status: 200, json: async () => handler() } as Response);
  });
  vi.stubGlobal('fetch', f);
  return f;
}

function emptyState(): ApiState {
  return { active_list: null, archive_count: 0, ingest: null };
}

function emptyDoneState(): ApiState {
  return {
    active_list: { id: 1, created_at: 0, archived_at: null, items: [] },
    archive_count: 3,
    ingest: null,
  };
}

function listState(items: ApiItem[]): ApiState {
  return {
    active_list: { id: 1, created_at: 0, archived_at: null, items },
    archive_count: 2,
    ingest: null,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('App view states', () => {
  it('renders StarterScreen when no list and no archive', async () => {
    mockFetch({ '/api/state': emptyState });
    render(<App />);
    await waitFor(() => expect(screen.getByText('Открыть чат с ботом')).toBeInTheDocument());
    expect(screen.getByText('Соберу список из ваших сообщений в чате — текста, голосовых и фото.')).toBeInTheDocument();
    expect(screen.getByText('Текст')).toBeInTheDocument();
    expect(screen.getByText('Голосовое')).toBeInTheDocument();
    expect(screen.getByText('Фото')).toBeInTheDocument();
  });

  it('renders EmptyState (done) when list empty but archive exists', async () => {
    mockFetch({ '/api/state': emptyDoneState });
    render(<App />);
    await waitFor(() => expect(screen.getByText('Все товары куплены')).toBeInTheDocument());
    expect(screen.getByText('Новый список')).toBeInTheDocument();
    expect(screen.getByText('Архив списков · 3')).toBeInTheDocument();
  });

  it('renders list view with items and progress', async () => {
    mockFetch({
      '/api/state': () => listState([
        { id: 10, name: 'молоко', qty: '1 л', done: false, position: 0 },
        { id: 11, name: 'хлеб', qty: null, done: true, position: 1 },
        { id: 12, name: 'яйца', qty: '10 шт', done: false, position: 2 },
      ]),
    });
    render(<App />);
    await waitFor(() => expect(screen.getByText('молоко')).toBeInTheDocument());
    expect(screen.getByText('хлеб')).toBeInTheDocument();
    expect(screen.getByText('яйца')).toBeInTheDocument();
    expect(screen.getByText('1 из 3')).toBeInTheDocument();
    expect(screen.getByText('Архив · 2')).toBeInTheDocument();
    expect(screen.getByText('Добавить товары')).toBeInTheDocument();
    expect(screen.getByText('Убрать купленное')).toBeInTheDocument();
  });

  it('does not show "Убрать купленное" when nothing is done', async () => {
    mockFetch({
      '/api/state': () => listState([
        { id: 10, name: 'молоко', qty: null, done: false, position: 0 },
      ]),
    });
    render(<App />);
    await waitFor(() => expect(screen.getByText('молоко')).toBeInTheDocument());
    expect(screen.queryByText('Убрать купленное')).not.toBeInTheDocument();
  });

  it('shows "Все товары куплены" overlay when allDone', async () => {
    mockFetch({
      '/api/state': () => listState([
        { id: 10, name: 'молоко', qty: null, done: true, position: 0 },
        { id: 11, name: 'хлеб', qty: null, done: true, position: 1 },
      ]),
    });
    render(<App />);
    await waitFor(() => expect(screen.getByText(/Все товары куплены — переношу в архив/)).toBeInTheDocument());
  });

  it('navigates to ArchiveScreen via header pill', async () => {
    mockFetch({
      '/api/state': () => listState([
        { id: 10, name: 'молоко', qty: null, done: false, position: 0 },
      ]),
      '/api/archive': () => ({ lists: [] }),
    });
    render(<App />);
    await waitFor(() => expect(screen.getByText('Архив · 2')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Архив · 2'));
    await waitFor(() => expect(screen.getByText('Пока нет архивных списков')).toBeInTheDocument());
    expect(screen.getByText('Архив')).toBeInTheDocument();
    expect(screen.getByText('К списку')).toBeInTheDocument();
  });
});

describe('App optimistic toggle', () => {
  it('sends POST /api/items/:id/toggle on row click', async () => {
    const f = mockFetch({
      '/api/state': () => listState([
        { id: 10, name: 'молоко', qty: null, done: false, position: 0 },
      ]),
      '/api/items/10/toggle': () => ({ list_id: 1, done: true, archived: false }),
    });
    render(<App />);
    await waitFor(() => expect(screen.getByText('молоко')).toBeInTheDocument());
    fireEvent.click(screen.getByText('молоко'));
    await waitFor(() => {
      expect(f).toHaveBeenCalledWith('/api/items/10/toggle', expect.objectContaining({ method: 'POST' }));
    });
  });
});

describe('App polling', () => {
  it('refreshes /api/state every 2000ms when visible', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const f = mockFetch({ '/api/state': emptyState });
    render(<App />);
    await waitFor(() => expect(f).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(2000);
    expect(f).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(f).toHaveBeenCalledTimes(3);
  });
});
