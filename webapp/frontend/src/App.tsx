import { useEffect, useRef, useState } from 'react';
import { T, useTheme } from './theme';
import { TOP_INSET, SF } from './lib/constants';
import { closeApp } from './lib/telegram';
import { Icon } from './icons';
import {
  archivePurchasedApi,
  deleteItemApi,
  fetchState,
  newListApi,
  patchItemApi,
  toggleItemApi,
} from './api/client';
import type { ApiIngest, ApiItem, ApiList } from './types';
import { ItemRow } from './components/ItemRow';
import { EditSheet } from './components/EditSheet';
import { ConfirmSheet } from './components/ConfirmSheet';
import { Progress } from './components/Progress';
import { StatusBanner } from './components/StatusBanner';
import { ChatHint } from './components/ChatHint';
import { StarterScreen } from './components/StarterScreen';
import { EmptyState } from './components/EmptyState';
import { ArchiveScreen } from './components/ArchiveScreen';
import { ArchiveDetailScreen } from './components/ArchiveDetailScreen';

type View = 'list' | 'archive' | 'archiveDetail';

export function App() {
  // Subscribe the root to theme changes so any theme update re-renders the
  // whole tree. Nested components read `T` directly from module state.
  useTheme();

  const [active, setActive] = useState<ApiList | null>(null);
  const [archiveCount, setArchiveCount] = useState(0);
  const [ingest, setIngest] = useState<ApiIngest | null>(null);
  const [view, setView] = useState<View>('list');
  const [openArchiveId, setOpenArchiveId] = useState<number | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [editing, setEditing] = useState<ApiItem | null>(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<ApiItem | null>(null);
  const [archivedFlash, setArchivedFlash] = useState(false);
  const lastIngestId = useRef<number | null>(null);
  const successHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = async () => {
    try {
      const data = await fetchState();
      setActive(data.active_list);
      setArchiveCount(data.archive_count || 0);
      setIngest((prev) => {
        void prev;
        const next = data.ingest || null;
        if (!next) {
          if (successHideTimer.current) {
            clearTimeout(successHideTimer.current);
            successHideTimer.current = null;
          }
          return null;
        }
        if (next.stage === 'success' && next.id !== lastIngestId.current) {
          lastIngestId.current = next.id;
          if (successHideTimer.current) clearTimeout(successHideTimer.current);
          successHideTimer.current = setTimeout(() => setIngest(null), 2400);
        } else if (next.stage !== 'success') {
          lastIngestId.current = next.id;
          if (successHideTimer.current) {
            clearTimeout(successHideTimer.current);
            successHideTimer.current = null;
          }
        }
        return next;
      });
    } catch (e) {
      console.error('state fetch failed', e);
    }
  };

  useEffect(() => {
    refresh();
    const tick = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const id = setInterval(tick, 2000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
      if (successHideTimer.current) clearTimeout(successHideTimer.current);
    };
  }, []);

  const onToggle = async (id: number) => {
    setActive((prev) => prev ? {
      ...prev,
      items: prev.items
        .map((it) => {
          if (it.id !== id) return it;
          const nextDone = !it.done;
          return {
            ...it,
            done: nextDone,
            checked_at: nextDone ? Math.floor(Date.now() / 1000) : null,
          };
        })
        .sort((a, b) => {
          if (a.done !== b.done) return (a.done ? 1 : 0) - (b.done ? 1 : 0);
          if (a.done) return (b.checked_at || 0) - (a.checked_at || 0);
          return a.position - b.position;
        }),
    } : prev);
    try {
      const r = await toggleItemApi(id);
      if (r.archived) {
        setArchivedFlash(true);
        setTimeout(() => {
          setArchivedFlash(false);
          refresh();
        }, 1400);
      }
    } catch (e) {
      console.error('toggle failed', e);
      refresh();
    }
  };

  const onSaveEdit = async (updated: ApiItem) => {
    try {
      await patchItemApi(updated.id, { name: updated.name, qty: updated.qty });
      setActive((prev) => prev ? {
        ...prev,
        items: prev.items.map((it) => (it.id === updated.id ? { ...it, name: updated.name, qty: updated.qty } : it)),
      } : prev);
    } catch (e) {
      console.error('patch failed', e);
    } finally {
      setEditing(null);
    }
  };

  const onDeleteItem = async (id: number) => {
    setActive((prev) => prev ? { ...prev, items: prev.items.filter((it) => it.id !== id) } : prev);
    try {
      await deleteItemApi(id);
    } catch (e) {
      console.error('delete failed', e);
      refresh();
    }
  };

  const onCreate = async () => {
    try {
      await newListApi();
    } catch (e) {
      console.error('new list failed', e);
    }
    closeApp();
  };

  const onArchivePurchased = async () => {
    if (!active) return;
    const listId = active.id;
    setActive((prev) => prev ? { ...prev, items: prev.items.filter((it) => !it.done) } : prev);
    try {
      await archivePurchasedApi(listId);
    } catch (e) {
      console.error('archive purchased failed', e);
    }
    refresh();
  };

  const items = active ? active.items : [];
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  const allDone = total > 0 && done === total;
  const ingestBusy = !!ingest && ingest.stage !== 'success' && ingest.stage !== 'error';

  if (view === 'archiveDetail' && openArchiveId !== null) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg, position: 'relative' }}>
        <ArchiveDetailScreen
          listId={openArchiveId}
          hasActive={total > 0}
          onBack={() => setView('archive')}
          onAfterReuse={() => { setView('list'); refresh(); }}
          onAfterDelete={() => { setView('archive'); refresh(); }}
        />
      </div>
    );
  }

  if (view === 'archive') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg }}>
        <ArchiveScreen
          onBack={() => setView('list')}
          onOpen={(id) => { setOpenArchiveId(id); setView('archiveDetail'); }}
        />
      </div>
    );
  }

  if (total === 0 && archiveCount === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg, position: 'relative' }}>
        <div style={{ height: TOP_INSET, flexShrink: 0 }}/>
        <StarterScreen onOpenChat={closeApp}/>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg, position: 'relative' }}>
        <div style={{ height: TOP_INSET, flexShrink: 0 }}/>
        <EmptyState
          kind="done"
          onCreate={onCreate}
          archiveCount={archiveCount}
          onOpenArchive={() => setView('archive')}
        />
        <StatusBanner ingest={ingest}/>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg, position: 'relative' }}>
      <div style={{ padding: `${TOP_INSET}px 22px 14px` }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            fontFamily: SF, fontSize: 28, fontWeight: 700, letterSpacing: -0.5,
            color: T.text, lineHeight: 1.15,
          }}>
            Список покупок
          </div>
          {archiveCount > 0 && (
            <button onClick={() => setView('archive')} style={{
              background: T.pillBg, border: 'none',
              padding: '7px 12px', borderRadius: 14,
              fontFamily: SF, fontSize: 13, color: T.blue, fontWeight: 500,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              flexShrink: 0,
            }}>
              <Icon.Archive s={14}/>
              Архив · {archiveCount}
            </button>
          )}
        </div>
      </div>

      <Progress done={done} total={total} onArchivePurchased={onArchivePurchased}/>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px' }}>
        <div style={{
          background: T.card, borderRadius: 18, overflow: 'hidden',
          opacity: (allDone || archivedFlash) ? 0.6 : 1, transition: 'opacity 0.3s',
        }}>
          {items.map((item, i) => (
            <ItemRow
              key={item.id}
              item={item}
              onToggle={onToggle}
              onEdit={(it) => setEditing(it)}
              onDelete={(it) => setConfirmDeleteItem(it)}
              isLast={i === items.length - 1}
              openId={openId}
              setOpenId={setOpenId}
            />
          ))}
        </div>
        {(allDone || archivedFlash) && (
          <div style={{
            textAlign: 'center', padding: '20px 0 8px',
            fontFamily: SF, fontSize: 15, color: T.accent, fontWeight: 500, letterSpacing: -0.24,
          }}>
            ✓ Все товары куплены — переношу в архив...
          </div>
        )}
      </div>

      <StatusBanner ingest={ingest}/>
      <ChatHint busy={ingestBusy}/>

      {editing && <EditSheet item={editing} onClose={() => setEditing(null)} onSave={onSaveEdit}/>}
      {confirmDeleteItem && (
        <ConfirmSheet
          title="Удалить товар?"
          desc={`«${confirmDeleteItem.name}» будет удалён из списка.`}
          confirmLabel="Удалить"
          onConfirm={() => {
            const id = confirmDeleteItem.id;
            setConfirmDeleteItem(null);
            onDeleteItem(id);
          }}
          onCancel={() => setConfirmDeleteItem(null)}
        />
      )}
    </div>
  );
}
