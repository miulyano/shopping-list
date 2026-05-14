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
  it('sends POST /api/items/:id/state with done:true on row click', async () => {
    const f = mockFetch({
      '/api/state': () => listState([
        { id: 10, name: 'молоко', qty: null, done: false, position: 0 },
      ]),
      '/api/items/10/state': () => ({ list_id: 1, done: true, archived: false }),
    });
    render(<App />);
    await waitFor(() => expect(screen.getByText('молоко')).toBeInTheDocument());
    fireEvent.click(screen.getByText('молоко'));
    await waitFor(() => {
      expect(f).toHaveBeenCalledWith('/api/items/10/state', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ done: true }),
      }));
    });
  });

  it('coalesces fast double tap into final desired state', async () => {
    // Two clicks before server responds. First request returns done:true;
    // the worker must then send a second request with done:false (the latest
    // desired state). Net effect on the row: still unchecked, as the user
    // intended.
    let resolveFirst: ((v: unknown) => void) | null = null;
    const stateCalls: unknown[] = [];
    stateCalls.push({ list_id: 1, done: true, archived: false });
    stateCalls.push({ list_id: 1, done: false, archived: false });

    const f = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/state') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => listState([
            { id: 10, name: 'молоко', qty: null, done: false, position: 0 },
          ]),
        } as Response);
      }
      if (url === '/api/items/10/state') {
        const body = JSON.parse((opts?.body as string) || '{}');
        if (resolveFirst) {
          const next = stateCalls.shift();
          return Promise.resolve({ ok: true, status: 200, json: async () => next } as Response);
        }
        return new Promise((resolve) => {
          resolveFirst = (v) => resolve({
            ok: true,
            status: 200,
            json: async () => v,
          } as Response);
          void body;
        });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    vi.stubGlobal('fetch', f);

    render(<App />);
    await waitFor(() => expect(screen.getByText('молоко')).toBeInTheDocument());
    const row = screen.getByText('молоко');
    fireEvent.click(row);
    fireEvent.click(row);
    // First request still hanging — release it now.
    await waitFor(() => expect(resolveFirst).not.toBeNull());
    resolveFirst!(stateCalls.shift());

    await waitFor(() => {
      const calls = f.mock.calls.filter((c: unknown[]) => c[0] === '/api/items/10/state');
      expect(calls).toHaveLength(2);
      const first = calls[0]![1] as RequestInit;
      const second = calls[1]![1] as RequestInit;
      expect(JSON.parse(first.body as string)).toEqual({ done: true });
      expect(JSON.parse(second.body as string)).toEqual({ done: false });
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
