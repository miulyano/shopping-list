import { useEffect, useState } from 'react';
import { T } from '../theme';
import { SF, TOP_INSET } from '../lib/constants';
import { Icon } from '../icons';
import { fmtDateTime } from '../lib/format';
import { usePrimary } from '../lib/primary';
import { deleteArchive, fetchArchiveOne, reuseArchive } from '../api/client';
import { CATEGORIES, catKey } from '../lib/categories';
import { pluralRu } from '../lib/format';
import type { ApiList, NamedList } from '../types';
import { ConfirmSheet } from './ConfirmSheet';
import { AddToListSheet } from './AddToListSheet';

interface Props {
  listId: number;
  lists: NamedList[];
  onBack: () => void;
  onAfterReuse: () => void;
  onAfterDelete: () => void;
}

export function ArchiveDetailScreen({ listId, lists, onBack, onAfterReuse, onAfterDelete }: Props) {
  const [list, setList] = useState<ApiList | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDel, setConfirmDel] = useState(false);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const primary = usePrimary();

  useEffect(() => {
    setLoading(true);
    fetchArchiveOne(listId)
      .then(setList)
      .catch((e) => console.error('archive detail failed', e))
      .finally(() => setLoading(false));
  }, [listId]);

  if (loading || !list) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.text2, fontFamily: SF }}>
        {loading ? 'Загрузка...' : 'Список не найден'}
      </div>
    );
  }

  const createdAt = new Date(list.created_at * 1000);
  const dateForConfirm = fmtDateTime(createdAt);
  const named = lists.find((l) => l.id === list.named_list_id);
  const listColor = named?.color ?? T.text2;
  const listName = named?.name ?? 'Список';

  // group archived items by category (all bought) — skip empty groups
  const groups = CATEGORIES
    .map((c) => ({ key: c.key, label: c.label, items: list.items.filter((it) => catKey(it.category) === c.key) }))
    .filter((g) => g.items.length > 0);

  const doReuse = async (targetId: number, itemIds: number[]) => {
    if (busy) return;
    setPicking(false);
    setBusy(true);
    try {
      await reuseArchive(listId, { named_list_id: targetId, item_ids: itemIds });
      onAfterReuse();
    } catch (e) {
      console.error('reuse failed', e);
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    setConfirmDel(false);
    setBusy(true);
    try {
      await deleteArchive(listId);
      onAfterDelete();
    } catch (e) {
      console.error('delete archive failed', e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        padding: `${TOP_INSET}px 16px 12px`,
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, top: TOP_INSET,
          height: 36, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
        }}>
          <span style={{
            fontFamily: SF, fontSize: 10, fontWeight: 600, color: T.text3,
            letterSpacing: 0.5, textTransform: 'uppercase', lineHeight: 1,
          }}>Архивирован</span>
          <span style={{
            fontFamily: SF, fontSize: 14.5, fontWeight: 600, color: T.text,
            letterSpacing: -0.2, fontVariantNumeric: 'tabular-nums', marginTop: 3,
          }}>{fmtDateTime(createdAt)}</span>
        </div>
        <button onClick={onBack} style={{
          height: 36, padding: '0 14px 0 10px', borderRadius: 18,
          background: T.pillBg, border: 'none', color: T.text,
          fontFamily: SF, fontSize: 14, fontWeight: 500, letterSpacing: -0.2,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <svg width="9" height="14" viewBox="0 0 9 14" fill="none">
            <path d="M7 1L1 7l6 6" stroke={T.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Архив
        </button>
        <button onClick={() => setConfirmDel(true)} style={{
          width: 36, height: 36, borderRadius: 18,
          background: T.pillBg, border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 5h12" stroke={T.red} strokeWidth="1.6" strokeLinecap="round"/>
            <path d="M7 5V3.5h4V5" stroke={T.red} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5 5l.6 9.5a1.4 1.4 0 001.4 1.3h4a1.4 1.4 0 001.4-1.3L13 5" stroke={T.red} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M7.5 8v5M10.5 8v5" stroke={T.red} strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <div style={{
        padding: '6px 22px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <span style={{ width: 9, height: 9, borderRadius: 5, flexShrink: 0, background: listColor }}/>
          <h1 style={{
            margin: 0, fontFamily: SF, fontSize: 19, fontWeight: 600,
            letterSpacing: -0.4, color: T.text, lineHeight: 1.1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{listName}</h1>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
          fontFamily: SF, fontSize: 14, color: T.accent, letterSpacing: -0.1,
          fontVariantNumeric: 'tabular-nums',
        }}>
          <Icon.Check s={12} c={T.accent}/>
          {list.items.length} {pluralRu(list.items.length, ['товар', 'товара', 'товаров'])}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {groups.map((g) => (
            <div key={g.key}>
              <div style={{ padding: '0 20px 7px' }}>
                <span style={{
                  fontFamily: SF, fontSize: 12.5, fontWeight: 600, letterSpacing: 0.3,
                  textTransform: 'uppercase', color: T.text2,
                }}>{g.label}</span>
              </div>
              <div style={{ background: T.card, borderRadius: 18, overflow: 'hidden' }}>
                {g.items.map((item, i) => (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', minHeight: 52,
                    padding: '0 18px', position: 'relative',
                  }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 11, marginRight: 14, flexShrink: 0,
                      background: T.accent,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon.Check s={12}/>
                    </div>
                    <div style={{
                      flex: 1, fontFamily: SF, fontSize: 16, letterSpacing: -0.32,
                      color: T.text2,
                    }}>
                      {item.name}
                      {item.qty && (
                        <span style={{ marginLeft: 8, fontSize: 14, color: 'currentColor', opacity: 0.7 }}>{item.qty}</span>
                      )}
                    </div>
                    {i < g.items.length - 1 && (
                      <div style={{ position: 'absolute', bottom: 0, left: 54, right: 0, height: 0.5, background: T.sep }}/>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        padding: '10px 16px 16px',
        background: T.surfaceBg,
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderTop: `0.5px solid ${T.sep}`,
      }}>
        <button onClick={() => setPicking(true)} disabled={busy} style={{
          width: '100%', height: 52, borderRadius: 14,
          ...primary,
          fontFamily: SF, fontSize: 17, fontWeight: 600, letterSpacing: -0.4,
          cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          Добавить в список
        </button>
      </div>

      {picking && (
        <AddToListSheet
          list={list}
          lists={lists}
          onClose={() => setPicking(false)}
          onAdd={doReuse}
        />
      )}

      {confirmDel && (
        <ConfirmSheet
          title="Удалить список?"
          desc={`Список от ${dateForConfirm} будет удалён без возможности восстановления.`}
          confirmLabel="Удалить"
          onConfirm={doDelete}
          onCancel={() => setConfirmDel(false)}
        />
      )}
    </div>
  );
}
