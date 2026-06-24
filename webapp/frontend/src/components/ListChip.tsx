import { T } from '../theme';
import { SF } from '../lib/constants';
import type { NamedList } from '../types';

interface Props {
  namedListId: number | null;
  lists: NamedList[];
  small?: boolean;
  big?: boolean;
}

/** Colour shield (dot + name) marking which named list something belongs to. */
export function ListChip({ namedListId, lists, small, big }: Props) {
  const l = lists.find((x) => x.id === namedListId);
  if (!l) return null;
  const c = l.color || T.text2;
  const h = big ? 30 : small ? 20 : 24;
  const fs = big ? 15 : small ? 11.5 : 13;
  const dot = big ? 7 : small ? 5 : 6;
  const pad = big ? '0 14px 0 12px' : small ? '0 8px 0 7px' : '0 11px 0 9px';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: big ? 7 : 5, flexShrink: 0,
      height: h, padding: pad,
      borderRadius: 999, background: c + '22', color: c,
      fontFamily: SF, fontSize: fs, fontWeight: 600,
      letterSpacing: -0.1, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: dot, height: dot, borderRadius: dot / 2, background: c }}/>
      {l.name}
    </span>
  );
}
