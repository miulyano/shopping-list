// Shopping list — Telegram Mini App.
// Ported from Claude Design handoff (app.jsx). iOS frame, theme-toggle и demo-симулятор
// убраны, source seed-data заменён на fetch к /api/*. Polling каждые 3 сек, пока вкладка видима.

const { useState, useEffect, useRef } = React;

const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
if (tg) { tg.ready(); tg.expand(); }

// ─── tokens ──────────────────────────────────────────────────
const LIGHT = {
  bg:        '#F2F2F7',
  card:      '#FFFFFF',
  text:      '#000000',
  text2:     'rgba(60,60,67,0.60)',
  text3:     'rgba(60,60,67,0.30)',
  sep:       'rgba(60,60,67,0.10)',
  accent:    '#34C759',
  accentBg:  'rgba(52,199,89,0.12)',
  blue:      '#007AFF',
  red:       '#FF3B30',
  tgHeader:  '#F7F7F7',
  pageBg:    '#E8E8EC',
  surfaceBg: 'rgba(247,247,247,0.92)',
  pillBg:    'rgba(120,120,128,0.12)',
  inverseFg: '#FFFFFF',
};
const DARK = {
  bg:        '#000000',
  card:      '#1C1C1E',
  text:      '#FFFFFF',
  text2:     'rgba(235,235,245,0.60)',
  text3:     'rgba(235,235,245,0.30)',
  sep:       'rgba(84,84,88,0.45)',
  accent:    '#30D158',
  accentBg:  'rgba(48,209,88,0.18)',
  blue:      '#0A84FF',
  red:       '#FF453A',
  tgHeader:  '#1C1C1E',
  pageBg:    '#0A0A0B',
  surfaceBg: 'rgba(28,28,30,0.92)',
  pillBg:    'rgba(120,120,128,0.24)',
  inverseFg: '#000000',
};
const T = { ...LIGHT };
function applyTheme(dark) {
  Object.assign(T, dark ? DARK : LIGHT);
  document.body.setAttribute('data-theme', dark ? 'dark' : 'light');
}

const SF = '-apple-system, "SF Pro Text", "SF Pro Display", system-ui, sans-serif';

const fmtDate = (d) => {
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
};

// ─── API ─────────────────────────────────────────────────────
const initData = tg ? tg.initData : '';

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      'X-Telegram-Init-Data': initData,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

const fetchState   = ()       => api('/api/state');
const fetchArchive = ()       => api('/api/archive');
const toggleItem   = (id)     => api(`/api/items/${id}/toggle`, { method: 'POST' });
const newList      = ()       => api('/api/lists/new', { method: 'POST' });

const closeApp = () => { if (tg) tg.close(); };

// ─── icons (stroke-based, Apple-ish) ────────────────────────
const Icon = {
  Plus: ({ s = 22, c }) => (
    <svg width={s} height={s} viewBox="0 0 22 22" fill="none">
      <path d="M11 4v14M4 11h14" stroke={c || T.text} strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  ),
  Mic: ({ s = 20, c }) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <rect x="7" y="2.5" width="6" height="11" rx="3" stroke={c || T.text2} strokeWidth="1.7"/>
      <path d="M4 9.5a6 6 0 0012 0M10 15.5v3" stroke={c || T.text2} strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  ),
  Camera: ({ s = 20, c }) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M2.5 7.5a2 2 0 012-2h1.6l1-1.5h5.8l1 1.5h1.6a2 2 0 012 2v7a2 2 0 01-2 2h-11a2 2 0 01-2-2v-7z" stroke={c || T.text2} strokeWidth="1.6"/>
      <circle cx="10" cy="11" r="3" stroke={c || T.text2} strokeWidth="1.6"/>
    </svg>
  ),
  Close: ({ s = 18, c }) => (
    <svg width={s} height={s} viewBox="0 0 18 18" fill="none">
      <path d="M5 5l8 8M13 5l-8 8" stroke={c || T.text2} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  Chevron: ({ s = 12, c }) => (
    <svg width={s/12*8} height={s} viewBox="0 0 8 12" fill="none">
      <path d="M1.5 1l5 5-5 5" stroke={c || T.text3} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Check: ({ s = 14, c = '#fff' }) => (
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <path d="M3 7.2l2.8 2.8L11 4.5" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  CheckBig: ({ s = 36, c }) => (
    <svg width={s} height={s} viewBox="0 0 36 36" fill="none">
      <path d="M9 18.5l6 6 12-13" stroke={c || T.accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Cart: ({ s = 38, c }) => (
    <svg width={s} height={s} viewBox="0 0 38 38" fill="none">
      <path d="M5 7h4l2.5 17a2 2 0 002 1.7h13.5a2 2 0 002-1.6L31 12H10.5" stroke={c || T.text3} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="14" cy="31" r="2" stroke={c || T.text3} strokeWidth="1.8"/>
      <circle cx="27" cy="31" r="2" stroke={c || T.text3} strokeWidth="1.8"/>
    </svg>
  ),
  Archive: ({ s = 18, c }) => (
    <svg width={s} height={s} viewBox="0 0 18 18" fill="none">
      <rect x="2" y="3" width="14" height="3.5" rx="1" stroke={c || T.blue} strokeWidth="1.6"/>
      <path d="M3 6.5v7.5a1.5 1.5 0 001.5 1.5h9A1.5 1.5 0 0015 14V6.5M7 9.5h4" stroke={c || T.blue} strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
};

// ─── checkbox row ────────────────────────────────────────────
function ItemRow({ item, onToggle, isLast }) {
  return (
    <div
      onClick={() => onToggle(item.id)}
      style={{
        display: 'flex', alignItems: 'center', minHeight: 56,
        padding: '0 18px', position: 'relative', cursor: 'pointer',
        userSelect: 'none', WebkitTapHighlightColor: 'transparent',
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
        textDecorationColor: T.text2,
        transition: 'color 0.2s ease',
      }}>
        {item.name}
        {item.qty && (
          <span style={{ color: T.text2, marginLeft: 8, fontSize: 15 }}>
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
  );
}

// ─── progress bar ────────────────────────────────────────────
function Progress({ done, total }) {
  const pct = total === 0 ? 0 : (done / total) * 100;
  return (
    <div style={{ padding: '0 22px 14px' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', marginBottom: 8,
        fontFamily: SF, fontSize: 13, letterSpacing: -0.08,
      }}>
        <span style={{ color: T.text2 }}>Куплено</span>
        <span style={{ color: T.text, fontVariantNumeric: 'tabular-nums', fontWeight: 500, whiteSpace: 'nowrap' }}>
          {done} из {total}
        </span>
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

// ─── chat hint (footer) ─────────────────────────────────────
function ChatHint() {
  return (
    <div style={{
      padding: '10px 14px 14px',
      background: T.surfaceBg,
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      borderTop: `0.5px solid ${T.sep}`,
    }}>
      <button
        onClick={closeApp}
        style={{
          width: '100%', height: 50, borderRadius: 14,
          background: T.card, border: `0.5px solid ${T.sep}`,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 14px', cursor: 'pointer',
          fontFamily: SF, textAlign: 'left',
        }}
      >
        <div style={{
          width: 28, height: 28, borderRadius: 14,
          background: 'linear-gradient(135deg, #54A9EB, #2A86D5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 6.5l10-4-1.5 10-3-2-2 2v-3l5-4.5" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" fill="none"/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 500, color: T.text, letterSpacing: -0.2,
            lineHeight: 1.2,
          }}>Откройте чат, чтобы добавить</div>
          <div style={{
            fontSize: 12, color: T.text2, letterSpacing: -0.08, marginTop: 1,
          }}>текст · голосовое · фото</div>
        </div>
        <Icon.Chevron s={14}/>
      </button>
    </div>
  );
}

// ─── starter screen (first launch, no archives) ─────────────
function StarterScreen({ onOpenChat }) {
  const methods = [
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M4 5h14M4 10h14M4 15h9" stroke={T.text} strokeWidth="1.7" strokeLinecap="round"/>
        </svg>
      ),
      title: 'Текст', desc: 'Молоко, хлеб, яйца',
      tint: 'rgba(0,122,255,0.14)',
    },
    {
      icon: <Icon.Mic s={22} c={T.text}/>,
      title: 'Голосовое', desc: '«Купить курицу и рис»',
      tint: 'rgba(255,149,0,0.16)',
    },
    {
      icon: <Icon.Camera s={22} c={T.text}/>,
      title: 'Фото', desc: 'Чек, холодильник, полки в магазине',
      tint: 'rgba(52,199,89,0.16)',
    },
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
        <div style={{
          fontFamily: SF, fontSize: 26, fontWeight: 700, letterSpacing: -0.5,
          color: T.text, textAlign: 'center', marginBottom: 6,
        }}>Список покупок</div>
        <div style={{
          fontFamily: SF, fontSize: 15, color: T.text2, letterSpacing: -0.24,
          lineHeight: 1.4, textAlign: 'center', maxWidth: 290,
        }}>Соберу список из ваших сообщений в чате — текста, голосовых и фото.</div>
      </div>

      <div style={{ background: T.card, borderRadius: 18, overflow: 'hidden', marginBottom: 14 }}>
        {methods.map((m, i) => (
          <div key={m.title} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 16px', position: 'relative',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: m.tint,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
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

      <div style={{
        fontFamily: SF, fontSize: 12, color: T.text3,
        letterSpacing: -0.08, lineHeight: 1.4, textAlign: 'center',
        padding: '0 8px', marginBottom: 18,
      }}>
        Отмечайте галочкой каждый купленный товар. Когда всё куплено — список уйдёт в архив.
      </div>

      <button onClick={onOpenChat} style={{
        height: 52, borderRadius: 14,
        background: T.text, border: 'none', color: T.inverseFg,
        fontFamily: SF, fontSize: 17, fontWeight: 500, letterSpacing: -0.4,
        cursor: 'pointer', display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 8,
      }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M2.5 8l13-5-2 13-4-2.5-2.5 2.5v-4l6.5-6"
            stroke={T.inverseFg} strokeWidth="1.6" strokeLinejoin="round" fill="none"/>
        </svg>
        Открыть чат с ботом
      </button>
    </div>
  );
}

// ─── empty / completed states ───────────────────────────────
function EmptyState({ kind, onCreate, archiveCount, onOpenArchive }) {
  const isDone = kind === 'done';
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '0 32px', textAlign: 'center',
      animation: 'fade 0.4s ease',
    }}>
      <div style={{
        width: 88, height: 88, borderRadius: 44,
        background: isDone ? T.accentBg : T.sep,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 22,
      }}>
        {isDone ? <Icon.CheckBig s={42}/> : <Icon.Cart s={42}/>}
      </div>
      <div style={{
        fontFamily: SF, fontSize: 22, fontWeight: 600, letterSpacing: -0.4,
        color: T.text, marginBottom: 6,
      }}>
        {isDone ? 'Все товары куплены' : 'Список покупок пуст'}
      </div>
      <div style={{
        fontFamily: SF, fontSize: 15, color: T.text2, letterSpacing: -0.24,
        lineHeight: 1.4, maxWidth: 280, marginBottom: 28,
      }}>
        {isDone
          ? 'Список перенесён в архив. Создайте новый — отправьте текст, голосовое или фото.'
          : 'Отправьте сообщение в чат — я добавлю товары автоматически.'}
      </div>
      <button onClick={onCreate} style={{
        height: 50, padding: '0 24px', borderRadius: 14,
        background: T.text, border: 'none', color: T.inverseFg,
        fontFamily: SF, fontSize: 17, fontWeight: 500, letterSpacing: -0.4,
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <Icon.Plus s={20} c={T.inverseFg}/>
        Новый список
      </button>

      {archiveCount > 0 && (
        <button onClick={onOpenArchive} style={{
          marginTop: 18, background: 'transparent', border: 'none',
          fontFamily: SF, fontSize: 15, color: T.blue, letterSpacing: -0.24,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Icon.Archive s={16}/>
          Архив списков · {archiveCount}
        </button>
      )}
    </div>
  );
}

// ─── archive screen ─────────────────────────────────────────
function ArchiveScreen({ onBack }) {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchArchive()
      .then(d => setLists(d.lists || []))
      .catch(e => console.error('archive load failed', e))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        padding: '20px 16px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ fontFamily: SF, fontSize: 28, fontWeight: 700, letterSpacing: -0.5, color: T.text }}>Архив</div>
        <button onClick={onBack} style={{
          height: 36, padding: '0 14px', borderRadius: 18,
          background: T.text, border: 'none', color: T.inverseFg,
          fontFamily: SF, fontSize: 14, fontWeight: 500, letterSpacing: -0.2,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <svg width="9" height="14" viewBox="0 0 9 14" fill="none">
            <path d="M7 1L1 7l6 6" stroke={T.inverseFg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          К списку
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 24px' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: T.text2, fontFamily: SF, fontSize: 15 }}>Загрузка...</div>
        ) : lists.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: T.text2, fontFamily: SF, fontSize: 15 }}>Пока нет архивных списков</div>
        ) : lists.map(list => (
          <div key={list.id} style={{
            background: T.card, borderRadius: 16, padding: '14px 16px', marginBottom: 10,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              marginBottom: 8,
            }}>
              <div style={{
                fontFamily: SF, fontSize: 15, fontWeight: 600, color: T.text, letterSpacing: -0.24,
              }}>Список от {fmtDate(new Date((list.archived_at || list.created_at) * 1000))}</div>
              <div style={{
                fontFamily: SF, fontSize: 13, color: T.accent, letterSpacing: -0.08,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <Icon.Check s={11} c={T.accent}/>
                {list.items.length} {pluralRu(list.items.length, ['товар','товара','товаров'])}
              </div>
            </div>
            <div style={{
              fontFamily: SF, fontSize: 14, color: T.text2, letterSpacing: -0.08,
              lineHeight: 1.45,
            }}>{list.items.map(i => i.name).join(' · ')}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function pluralRu(n, forms) {
  const a = Math.abs(n) % 100;
  const a1 = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (a1 > 1 && a1 < 5) return forms[1];
  if (a1 === 1) return forms[0];
  return forms[2];
}

// ─── telegram-style header ──────────────────────────────────
function TgHeader({ onClose }) {
  return (
    <div style={{
      paddingTop: 14, paddingBottom: 8,
      background: T.tgHeader,
      borderBottom: `0.5px solid ${T.sep}`,
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '14px 14px 8px',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 16,
        background: 'linear-gradient(135deg, #34C759, #30B0C7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16,
      }}>🛒</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: SF, fontSize: 15, fontWeight: 600, color: T.text, letterSpacing: -0.24,
        }}>Список покупок</div>
        <div style={{
          fontFamily: SF, fontSize: 12, color: T.text2, letterSpacing: -0.08,
        }}>mini app</div>
      </div>
      <button onClick={onClose} style={{
        width: 32, height: 32, borderRadius: 16, background: T.pillBg,
        border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
      }}>
        <Icon.Close s={14}/>
      </button>
    </div>
  );
}

// ─── main app ───────────────────────────────────────────────
function ShoppingApp() {
  const [active, setActive] = useState(null);          // {id, created_at, items: []} | null
  const [archiveCount, setArchiveCount] = useState(0);
  const [view, setView] = useState('list');            // 'list' | 'archive'
  const [archivedFlash, setArchivedFlash] = useState(false);
  const pollingRef = useRef(null);

  const refresh = async () => {
    try {
      const data = await fetchState();
      setActive(data.active_list);
      setArchiveCount(data.archive_count || 0);
    } catch (e) {
      console.error('state fetch failed', e);
    }
  };

  useEffect(() => {
    refresh();
    const tick = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    pollingRef.current = setInterval(tick, 3000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(pollingRef.current);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  const onToggle = async (id) => {
    setActive(prev => prev ? {
      ...prev,
      items: prev.items.map(it => it.id === id ? { ...it, done: !it.done } : it),
    } : prev);
    try {
      const r = await toggleItem(id);
      if (r.archived) {
        setArchivedFlash(true);
        setTimeout(() => { setArchivedFlash(false); refresh(); }, 1400);
      }
    } catch (e) {
      console.error('toggle failed', e);
      refresh();
    }
  };

  const onCreate = async () => {
    try {
      await newList();
    } catch (e) {
      console.error('new list failed', e);
    }
    closeApp();
  };

  const items = active ? active.items : [];
  const total = items.length;
  const done = items.filter(i => i.done).length;
  const allDone = total > 0 && done === total;

  if (view === 'archive') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg }}>
        <ArchiveScreen onBack={() => setView('list')}/>
      </div>
    );
  }

  // first launch — нет активного, нет архива
  if (total === 0 && archiveCount === 0) {
    return (
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        background: T.bg, position: 'relative',
      }}>
        <TgHeader onClose={closeApp}/>
        <StarterScreen onOpenChat={closeApp}/>
      </div>
    );
  }

  // активного списка нет, но архив есть
  if (total === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg, position: 'relative' }}>
        <TgHeader onClose={closeApp}/>
        <EmptyState
          kind="done"
          onCreate={onCreate}
          archiveCount={archiveCount}
          onOpenArchive={() => setView('archive')}
        />
      </div>
    );
  }

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: T.bg, position: 'relative',
    }}>
      <TgHeader onClose={closeApp}/>

      <div style={{ padding: '16px 22px 6px' }}>
        <div style={{
          fontFamily: SF, fontSize: 13, color: T.text2, letterSpacing: -0.08,
          textTransform: 'uppercase', fontWeight: 500, marginBottom: 4,
        }}>Активный список</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            fontFamily: SF, fontSize: 26, fontWeight: 700, letterSpacing: -0.5,
            color: T.text, lineHeight: 1.15,
          }}>
            Список покупок<br/>
            <span style={{ color: T.text2, fontWeight: 600 }}>от {fmtDate(new Date(active.created_at * 1000))}</span>
          </div>
          {archiveCount > 0 && (
            <button onClick={() => setView('archive')} style={{
              background: T.pillBg, border: 'none',
              padding: '7px 12px', borderRadius: 14,
              fontFamily: SF, fontSize: 13, color: T.blue, fontWeight: 500,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              flexShrink: 0, marginTop: 8,
            }}>
              <Icon.Archive s={14}/>
              Архив · {archiveCount}
            </button>
          )}
        </div>
      </div>

      <Progress done={done} total={total}/>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px' }}>
        <div style={{
          background: T.card, borderRadius: 18, overflow: 'hidden',
          opacity: (allDone || archivedFlash) ? 0.6 : 1, transition: 'opacity 0.3s',
        }}>
          {items.map((item, i) => (
            <ItemRow
              key={item.id}
              item={item}
              onToggle={onToggle}
              isLast={i === items.length - 1}
            />
          ))}
        </div>
        {(allDone || archivedFlash) && (
          <div style={{
            textAlign: 'center', padding: '20px 0 8px',
            fontFamily: SF, fontSize: 15, color: T.accent, fontWeight: 500,
            letterSpacing: -0.24,
          }}>
            ✓ Все товары куплены — переношу в архив...
          </div>
        )}
      </div>

      <ChatHint/>
    </div>
  );
}

// ─── theme + mount ───────────────────────────────────────────
function syncTheme() {
  const dark = tg ? tg.colorScheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(dark);
}
syncTheme();
if (tg) tg.onEvent('themeChanged', syncTheme);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncTheme);

ReactDOM.createRoot(document.getElementById('root')).render(<ShoppingApp/>);
