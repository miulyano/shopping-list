import { useLayoutEffect, useRef } from 'react';
import { T } from '../theme';
import { SF } from '../lib/constants';
import { Icon } from '../icons';
import { CATEGORIES, catKey } from '../lib/categories';
import type { ApiItem } from '../types';
import { ItemRow } from './ItemRow';

interface Props {
  items: ApiItem[];
  onToggle: (id: number) => void;
  onEdit: (item: ApiItem) => void;
  onDelete: (item: ApiItem) => void;
  openId: number | null;
  setOpenId: (id: number | null) => void;
}

/**
 * Renders the active list grouped by category (fixed CATEGORIES order, empty
 * groups skipped). `items` is expected pre-sorted by the parent (not-done
 * first, done sinking to the bottom by checked_at) — filtering per group
 * preserves that relative order. A FLIP pass animates rows whose vertical
 * position changed between renders (sink / rise).
 */
export function GroupedList({ items, onToggle, onEdit, onDelete, openId, setOpenId }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const prevPos = useRef<Map<string, number>>(new Map());

  const groups = CATEGORIES.map((c) => {
    const list = items.filter((it) => catKey(it.category) === c.key);
    return {
      key: c.key,
      label: c.label,
      items: list,
      done: list.filter((i) => i.done).length,
      total: list.length,
    };
  }).filter((g) => g.total > 0);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    // Measure each row's offset RELATIVE to the list root, not the viewport.
    // A viewport-relative top changes on every scroll (and on any layout shift
    // above the list, e.g. the status banner), which made the FLIP fire on each
    // 2s poll re-render — a constant flicker. Relative offset is scroll- and
    // layout-invariant, so the animation only runs on a real reorder (toggle).
    const rootTop = root.getBoundingClientRect().top;
    const nodes = root.querySelectorAll<HTMLElement>('[data-flip-id]');
    const next = new Map<string, number>();
    nodes.forEach((n) => next.set(n.getAttribute('data-flip-id')!, n.getBoundingClientRect().top - rootTop));
    next.forEach((top, id) => {
      const prev = prevPos.current.get(id);
      if (prev != null && Math.abs(prev - top) > 0.5) {
        const node = root.querySelector<HTMLElement>(`[data-flip-id="${id}"]`);
        node?.animate(
          [{ transform: `translateY(${prev - top}px)` }, { transform: 'translateY(0)' }],
          { duration: 360, easing: 'cubic-bezier(0.32,0.72,0,1)' },
        );
      }
    });
    prevPos.current = next;
  });

  return (
    <div ref={rootRef} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {groups.map((g) => {
        const complete = g.done === g.total;
        return (
          <div key={g.key}>
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
              padding: '0 20px 7px', gap: 12,
            }}>
              <span style={{
                fontFamily: SF, fontSize: 12.5, fontWeight: 600, letterSpacing: 0.3,
                textTransform: 'uppercase', color: T.text2,
              }}>{g.label}</span>
              <span style={{
                fontFamily: SF, fontSize: 12.5, fontWeight: 600, letterSpacing: 0.2,
                fontVariantNumeric: 'tabular-nums',
                color: complete ? T.accent : T.text3,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                {complete && <Icon.Check s={10} c={T.accent}/>}
                {g.done}/{g.total}
              </span>
            </div>
            <div style={{ background: T.card, borderRadius: 18, overflow: 'hidden' }}>
              {g.items.map((item, i) => (
                <div key={item.id} data-flip-id={item.id}>
                  <ItemRow
                    item={item}
                    onToggle={onToggle}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    isLast={i === g.items.length - 1}
                    openId={openId}
                    setOpenId={setOpenId}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
