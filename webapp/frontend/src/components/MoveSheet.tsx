import { useState } from 'react';
import { T } from '../theme';
import { SF } from '../lib/constants';
import { ListChip } from './ListChip';
import type { ApiItem, NamedList } from '../types';

interface Props {
  item: ApiItem;
  lists: NamedList[];
  onClose: () => void;
  onMove: (id: number, namedListId: number) => void;
}

/** Bottom sheet to reassign an item to another named list. */
export function MoveSheet({ item, lists, onClose, onMove }: Props) {
  const firstId = lists[0]?.id ?? 0;
  const [sel, setSel] = useState<number>(item.named_list_id ?? firstId);
  const confirm = () => onMove(item.id, sel);

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      display: 'flex', alignItems: 'flex-end',
      background: 'rgba(0,0,0,0.4)', animation: 'fade 0.2s ease',
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', background: T.bg,
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: '10px 16px 24px', boxSizing: 'border-box',
        animation: 'slideUp 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
      }}>
        <div style={{ width: 40, height: 5, borderRadius: 3, background: T.text3, margin: '0 auto 12px' }}/>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
        }}>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', padding: '6px 0',
            fontFamily: SF, fontSize: 17, color: T.blue, cursor: 'pointer', letterSpacing: -0.4,
          }}>Отмена</button>
          <div style={{ fontFamily: SF, fontSize: 17, fontWeight: 600, color: T.text, letterSpacing: -0.4 }}>
            Переместить товар
          </div>
          <button onClick={confirm} style={{
            background: 'none', border: 'none', padding: '6px 0',
            fontFamily: SF, fontSize: 17, color: T.blue, cursor: 'pointer', letterSpacing: -0.4, fontWeight: 600,
          }}>Готово</button>
        </div>

        {/* focal product card — what is being moved */}
        <div style={{
          background: T.card, borderRadius: 14, padding: '13px 16px',
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: SF, fontSize: 11.5, fontWeight: 600, color: T.text2,
              letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 3,
            }}>Товар</div>
            <div style={{
              fontFamily: SF, fontSize: 17, fontWeight: 400, color: T.text,
              letterSpacing: -0.4, lineHeight: 1.3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {item.name}
              {item.qty && (
                <span style={{ marginLeft: 8, fontSize: 15, color: T.text, opacity: 0.7 }}>{item.qty}</span>
              )}
            </div>
          </div>
          <ListChip namedListId={item.named_list_id ?? firstId} lists={lists}/>
        </div>

        <div style={{
          fontFamily: SF, fontSize: 11.5, fontWeight: 600, color: T.text2,
          letterSpacing: 0.3, textTransform: 'uppercase', padding: '0 4px 8px',
        }}>Переместить в список</div>

        <div style={{ background: T.card, borderRadius: 14, overflow: 'hidden' }}>
          {lists.map((l, i) => {
            const active = sel === l.id;
            return (
              <button key={l.id} onClick={() => setSel(l.id)} style={{
                width: '100%', border: 'none', background: 'transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 11,
                minHeight: 52, padding: '0 16px', position: 'relative',
                fontFamily: SF, fontSize: 17, letterSpacing: -0.4, color: T.text, textAlign: 'left',
              }}>
                <span style={{
                  width: 10, height: 10, borderRadius: 5, flexShrink: 0,
                  background: l.color || T.text3,
                }}/>
                <span style={{ flex: 1 }}>{l.name}</span>
                {active && (
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M3.5 9.5l3.5 3.5L14.5 5" stroke={T.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                {i < lists.length - 1 && (
                  <div style={{ position: 'absolute', bottom: 0, left: 37, right: 0, height: 0.5, background: T.sep }}/>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
