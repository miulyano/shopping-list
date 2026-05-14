import { useEffect, useState } from 'react';
import { T } from '../theme';
import { SF, TOP_INSET } from '../lib/constants';
import { Icon } from '../icons';
import { fmtDateTime, fmtDateTimeCaps } from '../lib/format';
import { usePrimary } from '../lib/primary';
import { deleteArchive, fetchArchiveOne, reuseArchive } from '../api/client';
import type { ApiList } from '../types';
import { ConfirmSheet } from './ConfirmSheet';

interface Props {
  listId: number;
  hasActive: boolean;
  onBack: () => void;
  onAfterReuse: () => void;
  onAfterDelete: () => void;
}

export function ArchiveDetailScreen({ listId, hasActive, onBack, onAfterReuse, onAfterDelete }: Props) {
  const [list, setList] = useState<ApiList | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDel, setConfirmDel] = useState(false);
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
  const reuseLabel = hasActive ? 'Добавить в текущий список' : 'Создать новый список';

  const doReuse = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await reuseArchive(listId);
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
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
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

      <div style={{ padding: '4px 22px 14px' }}>
        <div style={{
          fontFamily: SF, fontSize: 12, color: T.text2, letterSpacing: 0.4,
          textTransform: 'uppercase', fontWeight: 600, marginBottom: 6,
        }}>{fmtDateTimeCaps(createdAt)}</div>
        <div style={{ fontFamily: SF, fontSize: 26, fontWeight: 700, letterSpacing: -0.5, color: T.text, lineHeight: 1.15 }}>
          Список покупок
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px' }}>
        <div style={{ background: T.card, borderRadius: 18, overflow: 'hidden' }}>
          {list.items.map((item, i) => (
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
              {i < list.items.length - 1 && (
                <div style={{ position: 'absolute', bottom: 0, left: 54, right: 0, height: 0.5, background: T.sep }}/>
              )}
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
        <button onClick={doReuse} disabled={busy} style={{
          width: '100%', height: 52, borderRadius: 14,
          ...primary,
          fontFamily: SF, fontSize: 17, fontWeight: 600, letterSpacing: -0.4,
          cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {reuseLabel}
        </button>
      </div>

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
