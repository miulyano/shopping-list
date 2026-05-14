import { T } from '../theme';
import { SF } from '../lib/constants';

interface Props {
  done: number;
  total: number;
  onArchivePurchased?: () => void;
}

export function Progress({ done, total, onArchivePurchased }: Props) {
  const pct = total === 0 ? 0 : (done / total) * 100;
  const showArchive = done > 0 && done < total && typeof onArchivePurchased === 'function';
  return (
    <div style={{ padding: '0 22px 14px' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 8, gap: 12,
        fontFamily: SF, fontSize: 13, letterSpacing: -0.08,
      }}>
        <span style={{ color: T.text2 }}>Куплено</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {showArchive && (
            <button onClick={onArchivePurchased} style={{
              background: 'transparent', border: 'none',
              fontFamily: SF, fontSize: 13, color: T.blue, fontWeight: 500,
              letterSpacing: -0.08, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4, padding: 0,
            }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M7 1.5v7M4 6l3 3 3-3" stroke={T.blue} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 9.5v1.8a1.2 1.2 0 001.2 1.2h7.6a1.2 1.2 0 001.2-1.2V9.5" stroke={T.blue} strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              Убрать купленное
            </button>
          )}
          <span style={{ color: T.text, fontVariantNumeric: 'tabular-nums', fontWeight: 500, whiteSpace: 'nowrap' }}>
            {done} из {total}
          </span>
        </div>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: T.sep, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: T.accent,
          borderRadius: 2, transition: 'width 0.3s ease',
        }}/>
      </div>
    </div>
  );
}
