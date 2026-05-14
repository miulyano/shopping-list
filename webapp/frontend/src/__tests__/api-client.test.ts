import { describe, expect, it, vi } from 'vitest';
import {
  archivePurchasedApi,
  deleteArchive,
  deleteItemApi,
  fetchArchive,
  fetchArchiveOne,
  fetchState,
  newListApi,
  patchItemApi,
  reuseArchive,
  setItemDoneApi,
} from '../api/client';

function okJson(data: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: async () => data } as Response);
}

describe('api client', () => {
  it('GET /api/state sends X-Telegram-Init-Data and Content-Type', async () => {
    const f = vi.fn().mockReturnValue(okJson({ active_list: null, archive_count: 0, ingest: null }));
    vi.stubGlobal('fetch', f);
    await fetchState();
    expect(f).toHaveBeenCalledWith('/api/state', expect.objectContaining({
      headers: expect.objectContaining({
        'X-Telegram-Init-Data': 'test_init_data',
        'Content-Type': 'application/json',
      }),
    }));
  });

  it('throws on non-2xx with status + body text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'boom',
    }));
    await expect(fetchState()).rejects.toThrow('HTTP 500: boom');
  });

  it('POST /api/items/:id/state with done body', async () => {
    const f = vi.fn().mockReturnValue(okJson({ list_id: 1, done: true, archived: false }));
    vi.stubGlobal('fetch', f);
    await setItemDoneApi(42, true);
    expect(f).toHaveBeenCalledWith('/api/items/42/state', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ done: true }),
    }));
  });

  it('POST /api/items/:id/state sends done:false to unmark', async () => {
    const f = vi.fn().mockReturnValue(okJson({ list_id: 1, done: false, archived: false }));
    vi.stubGlobal('fetch', f);
    await setItemDoneApi(42, false);
    expect(f).toHaveBeenCalledWith('/api/items/42/state', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ done: false }),
    }));
  });

  it('PATCH /api/items/:id sends JSON body', async () => {
    const f = vi.fn().mockReturnValue(okJson({}));
    vi.stubGlobal('fetch', f);
    await patchItemApi(7, { name: 'молоко', qty: '1 л' });
    expect(f).toHaveBeenCalledWith('/api/items/7', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ name: 'молоко', qty: '1 л' }),
    }));
  });

  it('DELETE /api/items/:id', async () => {
    const f = vi.fn().mockReturnValue(okJson({}));
    vi.stubGlobal('fetch', f);
    await deleteItemApi(9);
    expect(f).toHaveBeenCalledWith('/api/items/9', expect.objectContaining({ method: 'DELETE' }));
  });

  it('GET /api/archive', async () => {
    const f = vi.fn().mockReturnValue(okJson({ lists: [] }));
    vi.stubGlobal('fetch', f);
    await fetchArchive();
    expect(f).toHaveBeenCalledWith('/api/archive', expect.anything());
  });

  it('GET /api/archive/:id', async () => {
    const f = vi.fn().mockReturnValue(okJson({}));
    vi.stubGlobal('fetch', f);
    await fetchArchiveOne(5);
    expect(f).toHaveBeenCalledWith('/api/archive/5', expect.anything());
  });

  it('POST /api/archive/:id/reuse', async () => {
    const f = vi.fn().mockReturnValue(okJson({ list_id: 1, added: 3 }));
    vi.stubGlobal('fetch', f);
    await reuseArchive(5);
    expect(f).toHaveBeenCalledWith('/api/archive/5/reuse', expect.objectContaining({ method: 'POST' }));
  });

  it('DELETE /api/archive/:id', async () => {
    const f = vi.fn().mockReturnValue(okJson({}));
    vi.stubGlobal('fetch', f);
    await deleteArchive(5);
    expect(f).toHaveBeenCalledWith('/api/archive/5', expect.objectContaining({ method: 'DELETE' }));
  });

  it('POST /api/lists/new', async () => {
    const f = vi.fn().mockReturnValue(okJson({ id: 1 }));
    vi.stubGlobal('fetch', f);
    await newListApi();
    expect(f).toHaveBeenCalledWith('/api/lists/new', expect.objectContaining({ method: 'POST' }));
  });

  it('POST /api/lists/:id/archive-purchased', async () => {
    const f = vi.fn().mockReturnValue(okJson({ archived_list_id: 2, moved: 4 }));
    vi.stubGlobal('fetch', f);
    await archivePurchasedApi(1);
    expect(f).toHaveBeenCalledWith('/api/lists/1/archive-purchased', expect.objectContaining({ method: 'POST' }));
  });
});
