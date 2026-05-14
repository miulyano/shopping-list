import { useState } from 'react';
import { T } from '../theme';
import { SF } from '../lib/constants';
import type { ApiItem } from '../types';

interface Props {
  item: ApiItem | null;
  onClose: () => void;
  onSave: (updated: ApiItem) => void;
}

export function EditSheet({ item, onClose, onSave }: Props) {
  const [name, setName] = useState(item?.name || '');
  const [qty, setQty] = useState(item?.qty || '');
  if (!item) return null;
  const save = () => {
    if (!name.trim()) return;
    onSave({ ...item, name: name.trim(), qty: qty.trim() || null });
  };
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      display: 'flex', alignItems: 'flex-end',
      background: 'rgba(0,0,0,0.4)',
      animation: 'fade 0.2s ease',
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', background: T.bg,
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: '10px 16px 24px', boxSizing: 'border-box',
        animation: 'slideUp 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
      }}>
        <div style={{
          width: 40, height: 5, borderRadius: 3, background: T.text3,
          margin: '0 auto 12px',
        }}/>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 14,
        }}>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', padding: '6px 0',
            fontFamily: SF, fontSize: 17, color: T.blue, cursor: 'pointer',
            letterSpacing: -0.4,
          }}>Отмена</button>
          <div style={{
            fontFamily: SF, fontSize: 17, fontWeight: 600, color: T.text,
            letterSpacing: -0.4,
          }}>Изменить товар</div>
          <button onClick={save} style={{
            background: 'none', border: 'none', padding: '6px 0',
            fontFamily: SF, fontSize: 17, color: T.blue, cursor: 'pointer',
            letterSpacing: -0.4, fontWeight: 600,
          }}>Готово</button>
        </div>

        <div style={{ background: T.card, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `0.5px solid ${T.sep}` }}>
            <div style={{
              fontFamily: SF, fontSize: 12, color: T.text2, letterSpacing: -0.08,
              textTransform: 'uppercase', fontWeight: 500, marginBottom: 4,
            }}>Название</div>
            <input
              autoFocus
              value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              placeholder="Например, Молоко"
              style={{
                width: '100%', border: 'none', outline: 'none', background: 'transparent',
                fontFamily: SF, fontSize: 17, color: T.text, letterSpacing: -0.4,
                padding: 0, boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ padding: '12px 16px' }}>
            <div style={{
              fontFamily: SF, fontSize: 12, color: T.text2, letterSpacing: -0.08,
              textTransform: 'uppercase', fontWeight: 500, marginBottom: 4,
            }}>Количество</div>
            <input
              value={qty} onChange={(e) => setQty(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              placeholder="1 л · 200 г · 4 шт"
              style={{
                width: '100%', border: 'none', outline: 'none', background: 'transparent',
                fontFamily: SF, fontSize: 17, color: T.text, letterSpacing: -0.4,
                padding: 0, boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <div style={{
          fontFamily: SF, fontSize: 12, color: T.text3, letterSpacing: -0.08,
          padding: '8px 12px 0', lineHeight: 1.4,
        }}>
          Количество необязательно. Можно указать вес, объём или штуки.
        </div>
      </div>
    </div>
  );
}
