import { T } from '../theme';
import { SF } from '../lib/constants';
import { Icon } from '../icons';
import { CATEGORIES, catKey } from '../lib/categories';
import type { ApiItem } from '../types';
import { ItemRow } from './ItemRow';
import type { OpenRow } from './ItemRow';

interface Props {
  items: ApiItem[];
  onToggle: (id: number) => void;
  onEdit: (item: ApiItem) => void;
  onDelete: (item: ApiItem) => void;
  onMove: (item: ApiItem) => void;
  canMove: boolean;
  openId: OpenRow;
  setOpenId: (open: OpenRow) => void;
}

/**
 * Renders the active list grouped by category (fixed CATEGORIES order, empty
 * groups skipped). `items` is expected pre-sorted by the parent (not-done
 * first, done sinking to the bottom by checked_at) — filtering per group
 * preserves that order. Rows are keyed by id, so a reorder is an instant DOM
 * move with no row-position animation (a FLIP pass here flickered on every
 * 2s poll re-render).
 */
export function GroupedList({ items, onToggle, onEdit, onDelete, onMove, canMove, openId, setOpenId }: Props) {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
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
                <ItemRow
                  key={item.id}
                  item={item}
                  onToggle={onToggle}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onMove={onMove}
                  canMove={canMove}
                  isLast={i === g.items.length - 1}
                  openId={openId}
                  setOpenId={setOpenId}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
