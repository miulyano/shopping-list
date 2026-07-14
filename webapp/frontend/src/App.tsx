import { useEffect, useRef, useState } from 'react';
import { T, useTheme } from './theme';
import { TOP_INSET, SF } from './lib/constants';
import { closeApp, getStartList } from './lib/telegram';
import { Icon } from './icons';
import {
  archivePurchasedApi,
  deleteItemApi,
  fetchState,
  moveItemApi,
  patchItemApi,
  setItemDoneApi,
} from './api/client';
import type { ApiIngest, ApiItem, ApiList, NamedList } from './types';

function sortItems(items: ApiItem[]): ApiItem[] {
  return [...items].sort((a, b) => {
    if (a.done !== b.done) return (a.done ? 1 : 0) - (b.done ? 1 : 0);
    // Checked items sink to the bottom; the most recently checked goes last
    // ("to the end"), so ticking an item appends it after earlier-checked ones.
    if (a.done) return (a.checked_at || 0) - (b.checked_at || 0);
    return a.position - b.position;
  });
}
import { GroupedList } from './components/GroupedList';
import type { OpenRow } from './components/ItemRow';
import { ListTabs } from './components/ListTabs';
import { MoveSheet } from './components/MoveSheet';
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
  // Synchronous mirror of `active` so onToggle can read the current done value
  // without waiting for the next render. React's setState updaters run lazily
  // (and may re-run in concurrent mode), so side effects derived from them
  // are unsafe — we keep a ref instead.
  const activeRef = useRef<ApiList | null>(null);
  const [lists, setLists] = useState<NamedList[]>([]);
  const [activeListId, setActiveListId] = useState<number | null>(null);
  const [archiveCount, setArchiveCount] = useState(0);
  const [ingest, setIngest] = useState<ApiIngest | null>(null);
  const [view, setView] = useState<View>('list');
  const [openArchiveId, setOpenArchiveId] = useState<number | null>(null);
  const [openId, setOpenId] = useState<OpenRow>(null);
  const [editing, setEditing] = useState<ApiItem | null>(null);
  const [moving, setMoving] = useState<ApiItem | null>(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<ApiItem | null>(null);
  const [archivedFlash, setArchivedFlash] = useState(false);
  // Reactive mirror of pendingItems.current.size — refs don't re-render, and
  // Progress needs to hide the manual archive button while toggles settle.
  const [pendingToggles, setPendingToggles] = useState(0);
  const lastIngestId = useRef<number | null>(null);
  const successHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Items currently in flight to /state — refresh() must not overwrite their
  // optimistic done/checked_at with stale server values until the toggle
  // request and its echo settle.
  const pendingItems = useRef<Set<number>>(new Set());
  // Items mid-move: keep their optimistic named_list_id until the server echoes
  // the new bucket, so a poll doesn't snap the row back to the old tab.
  const pendingMoves = useRef<Map<number, number>>(new Map());
  // Latest desired done per item id while a request is in flight. The worker
  // drains this map to coalesce rapid taps into at most one extra request.
  const desiredDone = useRef<Map<number, boolean>>(new Map());

  const refresh = async () => {
    try {
      const data = await fetchState();
      setLists(data.lists || []);
      setActiveListId((prev) => {
        const ls = data.lists || [];
        if (prev != null && ls.some((l) => l.id === prev)) return prev;
        const startKey = getStartList();
        const byKey = startKey ? ls.find((l) => l.key === startKey) : undefined;
        if (byKey) return byKey.id;
        const def = ls.find((l) => l.is_default) || ls[0];
        return def ? def.id : null;
      });
      setActive((prev) => {
        const next = data.active_list;
        if (!next) return next;
        if (!prev || (pendingItems.current.size === 0 && pendingMoves.current.size === 0)) {
          return next;
        }
        const merged = next.items.map((srv) => {
          let row = srv;
          if (pendingItems.current.has(srv.id)) {
            const local = prev.items.find((i) => i.id === srv.id);
            if (local) row = { ...row, done: local.done, checked_at: local.checked_at };
          }
          if (pendingMoves.current.has(srv.id)) {
            row = { ...row, named_list_id: pendingMoves.current.get(srv.id)! };
          }
          return row;
        });
        return { ...next, items: sortItems(merged) };
      });
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
    activeRef.current = active;
  }, [active]);

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
    const cur = activeRef.current?.items.find((it) => it.id === id);
    if (!cur) return;
    const target = !cur.done;
    const nextActive = activeRef.current
      ? {
          ...activeRef.current,
          items: sortItems(
            activeRef.current.items.map((it) =>
              it.id === id
                ? {
                    ...it,
                    done: target,
                    checked_at: target ? Math.floor(Date.now() / 1000) : null,
                  }
                : it,
            ),
          ),
        }
      : activeRef.current;
    activeRef.current = nextActive;
    setActive(nextActive);
    desiredDone.current.set(id, target);
    // Already a worker draining for this id — it will pick up the new desired.
    if (pendingItems.current.has(id)) return;

    pendingItems.current.add(id);
    setPendingToggles(pendingItems.current.size);
    try {
      while (desiredDone.current.has(id)) {
        const target = desiredDone.current.get(id)!;
        desiredDone.current.delete(id);
        const r = await setItemDoneApi(id, target);
        // Apply server-confirmed done to the row only when there is no newer
        // desired state queued — otherwise the next loop iteration will send
        // another request and we would briefly flicker to a stale value.
        if (!desiredDone.current.has(id)) {
          setActive((prev) => {
            if (!prev) return prev;
            const items = prev.items.map((it) => {
              if (it.id !== id) return it;
              if (it.done === r.done) return it;
              return {
                ...it,
                done: r.done,
                checked_at: r.done ? Math.floor(Date.now() / 1000) : null,
              };
            });
            return { ...prev, items: sortItems(items) };
          });
        }
        if (r.archived) {
          setArchivedFlash(true);
          setTimeout(() => {
            setArchivedFlash(false);
            refresh();
          }, 1400);
        }
      }
    } catch (e) {
      console.error('toggle failed', e);
      desiredDone.current.delete(id);
      refresh();
    } finally {
      pendingItems.current.delete(id);
      setPendingToggles(pendingItems.current.size);
    }
  };

  const onSaveEdit = async (updated: ApiItem) => {
    try {
      await patchItemApi(updated.id, {
        name: updated.name,
        qty: updated.qty,
        category: updated.category ?? undefined,
      });
      setActive((prev) => prev ? {
        ...prev,
        items: prev.items.map((it) => (it.id === updated.id ? { ...it, name: updated.name, qty: updated.qty, category: updated.category } : it)),
      } : prev);
    } catch (e) {
      console.error('patch failed', e);
    } finally {
      setEditing(null);
    }
  };

  const flashArchive = () => {
    setArchivedFlash(true);
    setTimeout(() => {
      setArchivedFlash(false);
      refresh();
    }, 1400);
  };

  const onMove = async (id: number, namedListId: number) => {
    setMoving(null);
    setOpenId(null);
    pendingMoves.current.set(id, namedListId);
    setActive((prev) => prev ? {
      ...prev,
      items: prev.items.map((it) => (it.id === id ? { ...it, named_list_id: namedListId } : it)),
    } : prev);
    try {
      const r = await moveItemApi(id, namedListId);
      pendingMoves.current.delete(id);
      // Flash only when the bucket the user is looking at was archived —
      // an off-screen destination archiving must not dim the current tab.
      if (activeListId != null && r.archived_named_list_ids.includes(activeListId)) {
        flashArchive();
      } else {
        refresh();
      }
    } catch (e) {
      console.error('move failed', e);
      pendingMoves.current.delete(id);
      refresh();
    }
  };

  const onDeleteItem = async (id: number) => {
    setActive((prev) => prev ? { ...prev, items: prev.items.filter((it) => it.id !== id) } : prev);
    try {
      const r = await deleteItemApi(id);
      if (r.archived) flashArchive();
    } catch (e) {
      console.error('delete failed', e);
      refresh();
    }
  };

  const onArchivePurchased = async () => {
    if (!active || activeListId == null) return;
    const listId = active.id;
    const bucket = activeListId;
    const dlt = lists.find((l) => l.is_default)?.id ?? lists[0]?.id ?? null;
    setActive((prev) => prev ? {
      ...prev,
      items: prev.items.filter((it) => !(it.done && (it.named_list_id ?? dlt) === bucket)),
    } : prev);
    try {
      await archivePurchasedApi(listId, bucket);
    } catch (e) {
      console.error('archive purchased failed', e);
    }
    refresh();
  };

  const allItems = active ? active.items : [];
  const defaultListId = lists.find((l) => l.is_default)?.id ?? lists[0]?.id ?? null;
  const inList = (it: ApiItem) => (it.named_list_id ?? defaultListId) === activeListId;
  const items = allItems.filter(inList);
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  const allDone = total > 0 && done === total;
  const canMove = lists.length > 1;
  const ingestBusy = !!ingest && ingest.stage !== 'success' && ingest.stage !== 'error';

  if (view === 'archiveDetail' && openArchiveId !== null) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg, position: 'relative' }}>
        <ArchiveDetailScreen
          listId={openArchiveId}
          lists={lists}
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
          lists={lists}
          onBack={() => setView('list')}
          onOpen={(id) => { setOpenArchiveId(id); setView('archiveDetail'); }}
        />
      </div>
    );
  }

  // First-launch: every list empty AND no archives.
  if (allItems.length === 0 && archiveCount === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg, position: 'relative' }}>
        <div style={{ height: TOP_INSET, flexShrink: 0 }}/>
        <StarterScreen onOpenChat={closeApp}/>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg, position: 'relative' }}>
      {/* header — list tabs as title (or plain title for a single list) + archive pill */}
      <div style={{ padding: `${TOP_INSET}px 0 0` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingRight: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {lists.length > 1 ? (
              <ListTabs
                lists={lists}
                activeId={activeListId}
                onChange={(id) => { setActiveListId(id); setOpenId(null); }}
              />
            ) : (
              <div style={{
                fontFamily: SF, fontSize: 28, fontWeight: 700, letterSpacing: -0.5,
                color: T.text, padding: '0 22px',
              }}>Список покупок</div>
            )}
          </div>
          {archiveCount > 0 && (
            <button onClick={() => setView('archive')} aria-label="Архив" style={{
              flexShrink: 0, height: 34, padding: '0 11px', borderRadius: 17,
              background: T.blue + '1F', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Icon.Archive s={17} c={T.blue}/>
              <span style={{
                fontFamily: SF, fontSize: 13.5, fontWeight: 700, color: T.blue,
                fontVariantNumeric: 'tabular-nums',
              }}>{archiveCount > 99 ? '99+' : archiveCount}</span>
            </button>
          )}
        </div>
      </div>

      {total > 0 && (
        <div style={{ paddingTop: 14 }}>
          <Progress
            done={done}
            total={total}
            settling={pendingToggles > 0 || archivedFlash}
            onArchivePurchased={onArchivePurchased}
          />
        </div>
      )}

      {total === 0 ? (
        <EmptyState
          kind="empty"
          onCreate={closeApp}
          archiveCount={archiveCount}
          onOpenArchive={() => setView('archive')}
        />
      ) : (
        <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px' }}>
          <div style={{
            opacity: (allDone || archivedFlash) ? 0.6 : 1, transition: 'opacity 0.3s',
          }}>
            <GroupedList
              items={items}
              onToggle={onToggle}
              onEdit={(it) => setEditing(it)}
              onDelete={(it) => setConfirmDeleteItem(it)}
              onMove={(it) => setMoving(it)}
              canMove={canMove}
              openId={openId}
              setOpenId={setOpenId}
            />
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
      )}

      <StatusBanner ingest={ingest}/>
      {total > 0 && <ChatHint busy={ingestBusy}/>}

      {editing && <EditSheet item={editing} onClose={() => setEditing(null)} onSave={onSaveEdit}/>}
      {moving && (
        <MoveSheet item={moving} lists={lists} onClose={() => setMoving(null)} onMove={onMove}/>
      )}
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
