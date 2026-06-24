import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import { T } from '../theme';
import { SF } from '../lib/constants';
import type { NamedList } from '../types';

interface Props {
  lists: NamedList[];
  activeId: number | null;
  onChange: (id: number) => void;
}

/**
 * Horizontal list-tab bar that doubles as the title row. Scrolls horizontally
 * when there are many lists (drag / wheel), keeps the active tab in view, and
 * underlines the active tab. Renders nothing for 0–1 lists (the parent shows a
 * plain title instead).
 */
export function ListTabs({ lists, activeId, onChange }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const drag = useRef({ down: false, moved: false, startX: 0, startScroll: 0 });

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const btn = c.querySelector('[data-active="1"]') as HTMLElement | null;
    if (!btn) return;
    const cr = c.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    const pad = 28;
    if (br.left < cr.left + pad) c.scrollLeft += br.left - cr.left - pad;
    else if (br.right > cr.right - pad) c.scrollLeft += br.right - cr.right + pad;
  }, [activeId]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const c = ref.current;
    if (!c) return;
    drag.current = { down: true, moved: false, startX: e.clientX, startScroll: c.scrollLeft };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d.down || !ref.current) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > 4) d.moved = true;
    if (d.moved) ref.current.scrollLeft = d.startScroll - dx;
  };
  const onPointerUp = () => { drag.current.down = false; };
  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    const c = ref.current;
    if (!c) return;
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) c.scrollLeft += e.deltaY;
  };

  if (!lists || lists.length <= 1) return null;

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerUp}
      onWheel={onWheel}
      style={{
        display: 'flex', gap: 20,
        overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        padding: '0 30px 0 22px', touchAction: 'pan-x',
        scrollbarWidth: 'none',
        WebkitMaskImage: 'linear-gradient(to right, #000 0, #000 calc(100% - 24px), transparent 100%)',
        maskImage: 'linear-gradient(to right, #000 0, #000 calc(100% - 24px), transparent 100%)',
      }}>
      {lists.map((l) => {
        const active = l.id === activeId;
        return (
          <button
            key={l.id}
            data-active={active ? '1' : '0'}
            onClick={() => { if (drag.current.moved) return; onChange(l.id); }}
            style={{
              flexShrink: 0, position: 'relative',
              border: 'none', background: 'transparent', cursor: 'pointer',
              padding: '4px 0 8px',
              display: 'flex', alignItems: 'center',
              fontFamily: SF, fontSize: 22, letterSpacing: -0.5,
              fontWeight: active ? 700 : 600,
              color: active ? T.text : T.text2,
              transition: 'color 0.2s ease',
              WebkitTapHighlightColor: 'transparent',
            }}>
            <span style={{ whiteSpace: 'nowrap' }}>{l.name}</span>
            {active && (
              <span style={{
                position: 'absolute', left: 0, right: 0, bottom: 0, height: 2.5,
                borderRadius: 2, background: T.text,
              }}/>
            )}
          </button>
        );
      })}
    </div>
  );
}
