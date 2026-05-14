import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { T } from '../theme';
import { SF } from '../lib/constants';
import { Icon } from '../icons';
import type { ApiItem } from '../types';

interface Props {
  item: ApiItem;
  onToggle: (id: number) => void;
  onEdit: (item: ApiItem) => void;
  onDelete: (item: ApiItem) => void;
  isLast: boolean;
  openId: number | null;
  setOpenId: (id: number | null) => void;
}

export function ItemRow({ item, onToggle, onEdit, onDelete, isLast, openId, setOpenId }: Props) {
  const ACTION_W = 76;
  const REVEAL = ACTION_W * 2;
  const isOpen = openId === item.id;
  const [drag, setDrag] = useState(0);
  const startX = useRef<number | null>(null);
  const startOffset = useRef(0);
  const moved = useRef(false);

  const offset = isOpen ? -REVEAL + drag : drag;
  const clampedOffset = Math.max(-REVEAL - 30, Math.min(0, offset));

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    startX.current = e.clientX;
    startOffset.current = isOpen ? -REVEAL : 0;
    moved.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 4) moved.current = true;
    const next = startOffset.current + dx;
    setDrag(next - (isOpen ? -REVEAL : 0));
  };
  const onPointerUp = () => {
    if (startX.current === null) return;
    const dx = drag + (isOpen ? -REVEAL : 0);
    if (dx < -REVEAL / 2) setOpenId(item.id);
    else setOpenId(null);
    setDrag(0);
    startX.current = null;
    setTimeout(() => {
      moved.current = false;
    }, 50);
  };

  const handleClick = () => {
    if (moved.current) return;
    if (isOpen) {
      setOpenId(null);
      return;
    }
    onToggle(item.id);
  };

  return (
    <div style={{ position: 'relative', overflow: 'hidden', background: T.card }}>
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0,
        display: 'flex', alignItems: 'stretch',
      }}>
        <button
          onClick={(e) => { e.stopPropagation(); setOpenId(null); onEdit(item); }}
          style={{
            width: ACTION_W, border: 'none', cursor: 'pointer',
            background: '#FF9500', color: '#fff',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 4,
            fontFamily: SF, fontSize: 12, fontWeight: 500,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M3 14.5L13.5 4l3 3L6 17.5H3v-3z" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" fill="none"/>
          </svg>
          Изменить
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setOpenId(null); onDelete(item); }}
          style={{
            width: ACTION_W, border: 'none', cursor: 'pointer',
            background: T.red, color: '#fff',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 4,
            fontFamily: SF, fontSize: 12, fontWeight: 500,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M3.5 6h13" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/>
            <path d="M8 6V4h4v2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5.5 6l.7 9.5a1.4 1.4 0 001.4 1.3h4.8a1.4 1.4 0 001.4-1.3L14.5 6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8.5 9v5M11.5 9v5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          Удалить
        </button>
      </div>

      <div
        onClick={handleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          display: 'flex', alignItems: 'center', minHeight: 56,
          padding: '0 18px', position: 'relative', cursor: 'pointer',
          userSelect: 'none', WebkitTapHighlightColor: 'transparent',
          background: T.card,
          transform: `translateX(${clampedOffset}px)`,
          transition: startX.current === null ? 'transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
          touchAction: 'pan-y',
        }}
      >
        <div style={{
          width: 24, height: 24, borderRadius: 12, marginRight: 14, flexShrink: 0,
          background: item.done ? T.accent : 'transparent',
          border: item.done ? 'none' : `1.6px solid ${T.text3}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s ease',
        }}>
          {item.done && <Icon.Check />}
        </div>
        <div style={{
          flex: 1, fontFamily: SF, fontSize: 17, letterSpacing: -0.4,
          color: item.done ? T.text2 : T.text,
          textDecoration: item.done ? 'line-through' : 'none',
          textDecorationColor: 'currentColor',
          textDecorationThickness: '1.5px',
          textDecorationSkipInk: 'none',
          transition: 'color 0.2s ease',
        }}>
          {item.name}
          {item.qty && (
            <span style={{
              marginLeft: 8,
              fontSize: item.done ? 17 : 15,
              color: 'currentColor',
              opacity: item.done ? 1 : 0.7,
            }}>
              {item.qty}
            </span>
          )}
        </div>
        {!isLast && (
          <div style={{
            position: 'absolute', bottom: 0, left: 56, right: 0,
            height: 0.5, background: T.sep,
          }}/>
        )}
      </div>
    </div>
  );
}
