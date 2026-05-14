import { T } from '../theme';
import { SF } from '../lib/constants';

interface Props {
  title: string;
  desc: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmSheet({ title, desc, confirmLabel, onConfirm, onCancel }: Props) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 38px',
      background: 'rgba(0,0,0,0.4)', boxSizing: 'border-box',
      animation: 'fade 0.2s ease',
    }} onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 270,
        background: T.card, borderRadius: 14, overflow: 'hidden',
        animation: 'alertPop 0.22s cubic-bezier(0.32, 0.72, 0, 1)',
      }}>
        <div style={{ padding: '18px 16px 16px', textAlign: 'center' }}>
          <div style={{
            fontFamily: SF, fontSize: 17, fontWeight: 600, color: T.text,
            letterSpacing: -0.4, marginBottom: 4,
          }}>{title}</div>
          <div style={{
            fontFamily: SF, fontSize: 13, color: T.text, letterSpacing: -0.08,
            lineHeight: 1.35,
          }}>{desc}</div>
        </div>
        <div style={{ display: 'flex', borderTop: `0.5px solid ${T.sep}` }}>
          <button onClick={onCancel} style={{
            flex: 1, height: 44, border: 'none', background: 'transparent',
            color: T.blue, fontFamily: SF, fontSize: 17, fontWeight: 400,
            letterSpacing: -0.4, cursor: 'pointer',
            borderRight: `0.5px solid ${T.sep}`,
          }}>Отмена</button>
          <button onClick={onConfirm} style={{
            flex: 1, height: 44, border: 'none', background: 'transparent',
            color: T.red, fontFamily: SF, fontSize: 17, fontWeight: 600,
            letterSpacing: -0.4, cursor: 'pointer',
          }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
