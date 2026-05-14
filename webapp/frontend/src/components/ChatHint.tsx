import { T } from '../theme';
import { SF } from '../lib/constants';
import { closeApp } from '../lib/telegram';
import { usePrimary } from '../lib/primary';

interface Props {
  busy: boolean;
}

export function ChatHint({ busy }: Props) {
  const primary = usePrimary();
  return (
    <div style={{
      padding: '10px 14px 14px',
      background: T.surfaceBg,
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      borderTop: `0.5px solid ${T.sep}`,
    }}>
      <button
        onClick={busy ? undefined : closeApp}
        disabled={!!busy}
        style={{
          width: '100%', height: 52, borderRadius: 14,
          ...primary,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          cursor: busy ? 'default' : 'pointer',
          opacity: busy ? 0.5 : 1, transition: 'opacity 0.2s',
          fontFamily: SF, fontSize: 17, fontWeight: 600, letterSpacing: -0.4,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M11.5 2.5l1.1 2.9 2.9 1.1-2.9 1.1-1.1 2.9-1.1-2.9L7.5 6.5l2.9-1.1 1.1-2.9z"
            fill={primary.color}/>
          <path d="M5 11l.6 1.6 1.6.6-1.6.6L5 15.4l-.6-1.6L2.8 13.2l1.6-.6L5 11z"
            fill={primary.color}/>
        </svg>
        Добавить товары
      </button>
    </div>
  );
}
