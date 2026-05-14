import { useEffect, useState } from 'react';
import { T } from '../theme';
import { SF, TOP_INSET } from '../lib/constants';
import { Icon } from '../icons';
import { fmtDateTime, pluralRu } from '../lib/format';
import { usePrimary } from '../lib/primary';
import { fetchArchive } from '../api/client';
import type { ApiList } from '../types';

interface Props {
  onBack: () => void;
  onOpen: (id: number) => void;
}

export function ArchiveScreen({ onBack, onOpen }: Props) {
  const [lists, setLists] = useState<ApiList[]>([]);
  const [loading, setLoading] = useState(true);
  const primary = usePrimary();

  useEffect(() => {
    setLoading(true);
    fetchArchive()
      .then((d) => setLists(d.lists || []))
      .catch((e) => console.error('archive load failed', e))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        padding: `${TOP_INSET}px 16px 14px`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ fontFamily: SF, fontSize: 28, fontWeight: 700, letterSpacing: -0.5, color: T.text }}>Архив</div>
        <button onClick={onBack} style={{
          height: 36, padding: '0 14px', borderRadius: 18,
          ...primary,
          fontFamily: SF, fontSize: 14, fontWeight: 500, letterSpacing: -0.2,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <svg width="9" height="14" viewBox="0 0 9 14" fill="none">
            <path d="M7 1L1 7l6 6" stroke={primary.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          К списку
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 24px' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: T.text2, fontFamily: SF, fontSize: 15 }}>Загрузка...</div>
        ) : lists.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: T.text2, fontFamily: SF, fontSize: 15 }}>Пока нет архивных списков</div>
        ) : lists.map((list) => (
          <button key={list.id} onClick={() => onOpen(list.id)} style={{
            display: 'block', width: '100%', textAlign: 'left',
            background: T.card, borderRadius: 16, padding: '14px 16px',
            marginBottom: 10, border: 'none', cursor: 'pointer', fontFamily: SF,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.text, letterSpacing: -0.24 }}>
                {fmtDateTime(new Date(list.created_at * 1000))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 13, color: T.accent, letterSpacing: -0.08, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icon.Check s={11} c={T.accent}/>
                  {list.items.length} {pluralRu(list.items.length, ['товар', 'товара', 'товаров'])}
                </div>
                <Icon.Chevron s={12} c={T.text3}/>
              </div>
            </div>
            <div style={{
              fontSize: 14, color: T.text2, letterSpacing: -0.08, lineHeight: 1.45,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>{list.items.map((i) => i.name).join(' · ')}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
