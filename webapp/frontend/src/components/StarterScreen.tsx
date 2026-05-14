import type { ReactNode } from 'react';
import { T } from '../theme';
import { SF } from '../lib/constants';
import { Icon } from '../icons';
import { usePrimary } from '../lib/primary';

interface Props {
  onOpenChat: () => void;
}

interface Method {
  icon: ReactNode;
  title: string;
  desc: string;
  tint: string;
}

export function StarterScreen({ onOpenChat }: Props) {
  const primary = usePrimary();
  const methods: Method[] = [
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M4 5h14M4 10h14M4 15h9" stroke={T.text} strokeWidth="1.7" strokeLinecap="round"/>
        </svg>
      ),
      title: 'Текст', desc: 'Молоко, хлеб, яйца',
      tint: 'rgba(0,122,255,0.14)',
    },
    { icon: <Icon.Mic s={22} c={T.text}/>, title: 'Голосовое', desc: '«Купить курицу и рис»', tint: 'rgba(255,149,0,0.16)' },
    { icon: <Icon.Camera s={22} c={T.text}/>, title: 'Фото', desc: 'Чек, холодильник, полки в магазине', tint: 'rgba(52,199,89,0.16)' },
  ];

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      justifyContent: 'center',
      padding: '8px 22px 24px', overflow: 'auto',
      animation: 'fade 0.4s ease',
    }}>
      <div style={{ marginBottom: 22, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          width: 80, height: 80, borderRadius: 22,
          background: 'linear-gradient(155deg, #34C759 0%, #30B0C7 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 12px 28px rgba(52,199,89,0.25)',
          marginBottom: 18,
        }}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <path d="M8 10h4l2.5 17a2 2 0 002 1.7h13.5a2 2 0 002-1.6L34 14H13.5"
              stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="17" cy="33" r="2" fill="#fff"/>
            <circle cx="29" cy="33" r="2" fill="#fff"/>
          </svg>
        </div>
        <div style={{ fontFamily: SF, fontSize: 26, fontWeight: 700, letterSpacing: -0.5, color: T.text, textAlign: 'center', marginBottom: 6 }}>Список покупок</div>
        <div style={{ fontFamily: SF, fontSize: 15, color: T.text2, letterSpacing: -0.24, lineHeight: 1.4, textAlign: 'center', maxWidth: 290 }}>
          Соберу список из ваших сообщений в чате — текста, голосовых и фото.
        </div>
      </div>

      <div style={{ background: T.card, borderRadius: 18, overflow: 'hidden', marginBottom: 14 }}>
        {methods.map((m, i) => (
          <div key={m.title} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', position: 'relative' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: m.tint,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>{m.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: T.text, letterSpacing: -0.24 }}>{m.title}</div>
              <div style={{ fontFamily: SF, fontSize: 13, color: T.text2, letterSpacing: -0.08, marginTop: 2 }}>{m.desc}</div>
            </div>
            {i < methods.length - 1 && (
              <div style={{ position: 'absolute', bottom: 0, left: 66, right: 0, height: 0.5, background: T.sep }}/>
            )}
          </div>
        ))}
      </div>

      <div style={{ fontFamily: SF, fontSize: 12, color: T.text3, letterSpacing: -0.08, lineHeight: 1.4, textAlign: 'center', padding: '0 8px', marginBottom: 18 }}>
        Отмечайте галочкой каждый купленный товар. Когда всё куплено — список уйдёт в архив.
      </div>

      <button onClick={onOpenChat} style={{
        height: 52, borderRadius: 14,
        ...primary,
        fontFamily: SF, fontSize: 17, fontWeight: 500, letterSpacing: -0.4,
        cursor: 'pointer', display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 8,
      }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M2.5 8l13-5-2 13-4-2.5-2.5 2.5v-4l6.5-6"
            stroke={primary.color} strokeWidth="1.6" strokeLinejoin="round" fill="none"/>
        </svg>
        Открыть чат с ботом
      </button>
    </div>
  );
}
