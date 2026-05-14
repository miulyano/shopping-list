import { tg } from '../lib/telegram';
import type {
  ApiArchiveList,
  ApiArchivePurchasedResult,
  ApiList,
  ApiReuseResult,
  ApiState,
  ApiToggleResult,
} from '../types';

const initData = tg ? tg.initData : '';

async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    headers: {
      'X-Telegram-Init-Data': initData,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const fetchState = (): Promise<ApiState> => api('/api/state');
export const fetchArchive = (): Promise<ApiArchiveList> => api('/api/archive');
export const fetchArchiveOne = (id: number): Promise<ApiList> => api(`/api/archive/${id}`);
export const reuseArchive = (id: number): Promise<ApiReuseResult> =>
  api(`/api/archive/${id}/reuse`, { method: 'POST' });
export const deleteArchive = (id: number): Promise<{ deleted: boolean }> =>
  api(`/api/archive/${id}`, { method: 'DELETE' });
export const toggleItemApi = (id: number): Promise<ApiToggleResult> =>
  api(`/api/items/${id}/toggle`, { method: 'POST' });
export const patchItemApi = (
  id: number,
  body: { name: string; qty: string | null },
): Promise<{ id: number; list_id: number; name: string; qty: string | null }> =>
  api(`/api/items/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const deleteItemApi = (
  id: number,
): Promise<{ id: number; list_id: number; deleted: boolean }> =>
  api(`/api/items/${id}`, { method: 'DELETE' });
export const newListApi = (): Promise<{ id: number }> =>
  api('/api/lists/new', { method: 'POST' });
export const archivePurchasedApi = (listId: number): Promise<ApiArchivePurchasedResult> =>
  api(`/api/lists/${listId}/archive-purchased`, { method: 'POST' });
