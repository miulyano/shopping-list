// Shopping list — Telegram Mini App.
// Polling /api/state каждые 2 сек, пока вкладка видима. Состояние ingest
// приходит в том же /api/state и рисует status-баннер над футером.

const { useState, useEffect, useRef } = React;

const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

const MOBILE_PLATFORMS = new Set(['android', 'android_x', 'ios']);

function isMobileTg(t) {
  return t && MOBILE_PLATFORMS.has(t.platform);
}

function atLeast(t, version) {
  return t && typeof t.isVersionAtLeast === 'function' && t.isVersionAtLeast(version);
}

function lockMiniApp(t) {
  if (!t) return;
  t.ready();
  t.expand();
  if (!isMobileTg(t)) return;
  if (atLeast(t, '7.7') && typeof t.disableVerticalSwipes === 'function') {
    try { t.disableVerticalSwipes(); } catch (_) {}
  }
  if (atLeast(t, '8.0') && typeof t.requestFullscreen === 'function' && !t.isFullscreen) {
    try { t.requestFullscreen(); } catch (_) {}
    if (typeof t.onEvent === 'function') {
      t.onEvent('fullscreenFailed', (e) => {
        console.warn('[tg] fullscreenFailed', e && e.error);
      });
    }
  }
}

lockMiniApp(tg);

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
const T = { ...LIGHT, dark: false };
function applyTheme(dark) {
  Object.assign(T, dark ? DARK : LIGHT);
  T.dark = !!dark;
  document.body.setAttribute('data-theme', dark ? 'dark' : 'light');
}

const SF = '-apple-system, "SF Pro Text", "SF Pro Display", system-ui, sans-serif';

const fmtDate = (d) => {
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
};

const pad2 = (n) => String(n).padStart(2, '0');
const fmtDateTime = (d) => `${fmtDate(d)}, ${d.getHours()}:${pad2(d.getMinutes())}`;
const fmtDateTimeCaps = (d) => fmtDateTime(d).toUpperCase();

// Primary CTA style — tinted blue in light theme, solid black in dark.
function usePrimary() {
  if (T.dark) {
    return { background: T.text, color: T.inverseFg, border: 'none' };
  }
  return { background: 'rgba(0,122,255,0.14)', color: T.blue, border: 'none' };
}

function pluralRu(n, forms) {
  const a = Math.abs(n) % 100;
  const a1 = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (a1 > 1 && a1 < 5) return forms[1];
  if (a1 === 1) return forms[0];
  return forms[2];
}

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

const fetchState        = ()           => api('/api/state');
const fetchArchive      = ()           => api('/api/archive');
const fetchArchiveOne   = (id)         => api(`/api/archive/${id}`);
const reuseArchive      = (id)         => api(`/api/archive/${id}/reuse`, { method: 'POST' });
const deleteArchive     = (id)         => api(`/api/archive/${id}`, { method: 'DELETE' });
const toggleItemApi     = (id)         => api(`/api/items/${id}/toggle`, { method: 'POST' });
const patchItemApi      = (id, body)   => api(`/api/items/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
const deleteItemApi     = (id)         => api(`/api/items/${id}`, { method: 'DELETE' });
const newListApi        = ()           => api('/api/lists/new', { method: 'POST' });
const archivePurchasedApi = (listId)   => api(`/api/lists/${listId}/archive-purchased`, { method: 'POST' });

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

// ─── swipeable checkbox row ─────────────────────────────────
function ItemRow({ item, onToggle, onEdit, onDelete, isLast, openId, setOpenId }) {
  const ACTION_W = 76;
  const REVEAL = ACTION_W * 2;
  const isOpen = openId === item.id;
  const [drag, setDrag] = useState(0);
  const startX = useRef(null);
  const startOffset = useRef(0);
  const moved = useRef(false);

  const offset = isOpen ? -REVEAL + drag : drag;
  const clampedOffset = Math.max(-REVEAL - 30, Math.min(0, offset));

  const onPointerDown = (e) => {
    startX.current = e.clientX;
    startOffset.current = isOpen ? -REVEAL : 0;
    moved.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
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
    setTimeout(() => { moved.current = false; }, 50);
  };

  const handleClick = () => {
    if (moved.current) return;
    if (isOpen) { setOpenId(null); return; }
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

// ─── edit sheet ─────────────────────────────────────────────
function EditSheet({ item, onClose, onSave }) {
  const [name, setName] = useState(item?.name || '');
  const [qty, setQty] = useState(item?.qty || '');
  if (!item) return null;
  const save = () => {
    if (!name.trim()) return;
    onSave({ ...item, name: name.trim(), qty: qty.trim() || null });
  };
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      display: 'flex', alignItems: 'flex-end',
      background: 'rgba(0,0,0,0.4)',
      animation: 'fade 0.2s ease',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', background: T.bg,
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: '10px 16px 24px', boxSizing: 'border-box',
        animation: 'slideUp 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
      }}>
        <div style={{
          width: 40, height: 5, borderRadius: 3, background: T.text3,
          margin: '0 auto 12px',
        }}/>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 14,
        }}>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', padding: '6px 0',
            fontFamily: SF, fontSize: 17, color: T.blue, cursor: 'pointer',
            letterSpacing: -0.4,
          }}>Отмена</button>
          <div style={{
            fontFamily: SF, fontSize: 17, fontWeight: 600, color: T.text,
            letterSpacing: -0.4,
          }}>Изменить товар</div>
          <button onClick={save} style={{
            background: 'none', border: 'none', padding: '6px 0',
            fontFamily: SF, fontSize: 17, color: T.blue, cursor: 'pointer',
            letterSpacing: -0.4, fontWeight: 600,
          }}>Готово</button>
        </div>

        <div style={{ background: T.card, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `0.5px solid ${T.sep}` }}>
            <div style={{
              fontFamily: SF, fontSize: 12, color: T.text2, letterSpacing: -0.08,
              textTransform: 'uppercase', fontWeight: 500, marginBottom: 4,
            }}>Название</div>
            <input
              autoFocus
              value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && save()}
              placeholder="Например, Молоко"
              style={{
                width: '100%', border: 'none', outline: 'none', background: 'transparent',
                fontFamily: SF, fontSize: 17, color: T.text, letterSpacing: -0.4,
                padding: 0, boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ padding: '12px 16px' }}>
            <div style={{
              fontFamily: SF, fontSize: 12, color: T.text2, letterSpacing: -0.08,
              textTransform: 'uppercase', fontWeight: 500, marginBottom: 4,
            }}>Количество</div>
            <input
              value={qty} onChange={e => setQty(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && save()}
              placeholder="1 л · 200 г · 4 шт"
              style={{
                width: '100%', border: 'none', outline: 'none', background: 'transparent',
                fontFamily: SF, fontSize: 17, color: T.text, letterSpacing: -0.4,
                padding: 0, boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <div style={{
          fontFamily: SF, fontSize: 12, color: T.text3, letterSpacing: -0.08,
          padding: '8px 12px 0', lineHeight: 1.4,
        }}>
          Количество необязательно. Можно указать вес, объём или штуки.
        </div>
      </div>
    </div>
  );
}

// ─── ios-style alert dialog ─────────────────────────────────
function ConfirmSheet({ title, desc, confirmLabel, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 38px',
      background: 'rgba(0,0,0,0.4)', boxSizing: 'border-box',
      animation: 'fade 0.2s ease',
    }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
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

// ─── progress bar ────────────────────────────────────────────
function Progress({ done, total, onArchivePurchased }) {
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

// ─── status banner ──────────────────────────────────────────
function StatusBanner({ ingest }) {
  if (!ingest) return null;
  const isSuccess = ingest.stage === 'success';
  const isError = ingest.stage === 'error';
  const isVoice = ingest.kind === 'voice' && !isSuccess && !isError;
  const isPhoto = ingest.kind === 'photo' && !isSuccess && !isError;
  const isParsing = !isSuccess && !isError && !isVoice && !isPhoto;
  return (
    <div style={{
      margin: '0 12px 8px',
      background: T.card,
      borderRadius: 14,
      padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
      animation: 'slideUp 0.25s ease',
    }}>
      {isVoice && <VoiceWave/>}
      {isPhoto && <PhotoThumb/>}
      {isParsing && <Spinner/>}
      {isSuccess && (
        <div style={{
          width: 24, height: 24, borderRadius: 12, background: T.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon.Check s={14}/>
        </div>
      )}
      {isError && (
        <div style={{
          width: 24, height: 24, borderRadius: 12, background: T.red,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          color: '#fff', fontFamily: SF, fontSize: 14, fontWeight: 700,
        }}>!</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: SF, fontSize: 15, fontWeight: 500, color: T.text, letterSpacing: -0.24,
        }}>{ingest.title}</div>
        {ingest.sub && (
          <div style={{
            fontFamily: SF, fontSize: 13, color: T.text2, letterSpacing: -0.08,
            marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{ingest.sub}</div>
        )}
      </div>
    </div>
  );
}

function VoiceWave() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, width: 24, height: 24, justifyContent: 'center', flexShrink: 0 }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{
          width: 3, borderRadius: 1.5, background: T.blue,
          animation: `wave 0.9s ease-in-out ${i * 0.12}s infinite`,
        }}/>
      ))}
    </div>
  );
}

function PhotoThumb() {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 6, flexShrink: 0,
      background: 'linear-gradient(135deg, #FFE5B4, #FFA07A)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
        animation: 'shimmer 1.4s linear infinite',
      }}/>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{
      width: 22, height: 22, flexShrink: 0,
      border: `2px solid ${T.sep}`,
      borderTopColor: T.blue,
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }}/>
  );
}

// ─── chat hint (footer) ─────────────────────────────────────
function ChatHint({ busy }) {
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

// ─── starter screen (first launch, no archives) ─────────────
function StarterScreen({ onOpenChat }) {
  const primary = usePrimary();
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

// ─── empty / completed states ───────────────────────────────
function EmptyState({ kind, onCreate, archiveCount, onOpenArchive }) {
  const isDone = kind === 'done';
  const primary = usePrimary();
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
      <div style={{ fontFamily: SF, fontSize: 22, fontWeight: 600, letterSpacing: -0.4, color: T.text, marginBottom: 6 }}>
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
        ...primary,
        fontFamily: SF, fontSize: 17, fontWeight: 500, letterSpacing: -0.4,
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <Icon.Plus s={20} c={primary.color}/>
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

// ─── archive list screen ────────────────────────────────────
function ArchiveScreen({ onBack, onOpen }) {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const primary = usePrimary();

  const reload = () => {
    setLoading(true);
    fetchArchive()
      .then(d => setLists(d.lists || []))
      .catch(e => console.error('archive load failed', e))
      .finally(() => setLoading(false));
  };
  useEffect(reload, []);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        padding: '64px 16px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ fontFamily: SF, fontSize: 28, fontWeight: 700, letterSpacing: -0.5, color: T.text }}>Архив</div>
        <button onClick={onBack} style={{
          height: 36, padding: '0 14px', borderRadius: 18,
          ...primary,
          fontFamily: SF, fontSize: 14, fontWeight: 500, letterSpacing: -0.2,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <svg width="9" height="14" viewBox="0 0 9 14" fill="none">
            <path d="M7 1L1 7l6 6" stroke={primary.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
          <button key={list.id} onClick={() => onOpen(list.id)} style={{
            display: 'block', width: '100%', textAlign: 'left',
            background: T.card, borderRadius: 16, padding: '14px 16px',
            marginBottom: 10, border: 'none', cursor: 'pointer', fontFamily: SF,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.text, letterSpacing: -0.24 }}>
                {fmtDateTime(new Date(list.created_at * 1000))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 13, color: T.accent, letterSpacing: -0.08, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icon.Check s={11} c={T.accent}/>
                  {list.items.length} {pluralRu(list.items.length, ['товар','товара','товаров'])}
                </div>
                <Icon.Chevron s={12} c={T.text3}/>
              </div>
            </div>
            <div style={{
              fontSize: 14, color: T.text2, letterSpacing: -0.08, lineHeight: 1.45,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>{list.items.map(i => i.name).join(' · ')}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── archive detail (one archived list) ─────────────────────
function ArchiveDetailScreen({ listId, hasActive, onBack, onAfterReuse, onAfterDelete }) {
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const primary = usePrimary();

  useEffect(() => {
    setLoading(true);
    fetchArchiveOne(listId)
      .then(setList)
      .catch(e => console.error('archive detail failed', e))
      .finally(() => setLoading(false));
  }, [listId]);

  if (loading || !list) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.text2, fontFamily: SF }}>
        {loading ? 'Загрузка...' : 'Список не найден'}
      </div>
    );
  }

  const createdAt = new Date(list.created_at * 1000);
  const dateForConfirm = fmtDateTime(createdAt);
  const reuseLabel = hasActive ? 'Добавить в текущий список' : 'Создать новый список';

  const doReuse = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await reuseArchive(listId);
      onAfterReuse();
    } catch (e) {
      console.error('reuse failed', e);
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    setConfirmDel(false);
    setBusy(true);
    try {
      await deleteArchive(listId);
      onAfterDelete();
    } catch (e) {
      console.error('delete archive failed', e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        padding: '64px 16px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <button onClick={onBack} style={{
          height: 36, padding: '0 14px 0 10px', borderRadius: 18,
          background: T.pillBg, border: 'none', color: T.text,
          fontFamily: SF, fontSize: 14, fontWeight: 500, letterSpacing: -0.2,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <svg width="9" height="14" viewBox="0 0 9 14" fill="none">
            <path d="M7 1L1 7l6 6" stroke={T.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Архив
        </button>
        <button onClick={() => setConfirmDel(true)} style={{
          width: 36, height: 36, borderRadius: 18,
          background: T.pillBg, border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 5h12" stroke={T.red} strokeWidth="1.6" strokeLinecap="round"/>
            <path d="M7 5V3.5h4V5" stroke={T.red} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5 5l.6 9.5a1.4 1.4 0 001.4 1.3h4a1.4 1.4 0 001.4-1.3L13 5" stroke={T.red} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M7.5 8v5M10.5 8v5" stroke={T.red} strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <div style={{ padding: '4px 22px 14px' }}>
        <div style={{
          fontFamily: SF, fontSize: 12, color: T.text2, letterSpacing: 0.4,
          textTransform: 'uppercase', fontWeight: 600, marginBottom: 6,
        }}>{fmtDateTimeCaps(createdAt)}</div>
        <div style={{ fontFamily: SF, fontSize: 26, fontWeight: 700, letterSpacing: -0.5, color: T.text, lineHeight: 1.15 }}>
          Список покупок
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px' }}>
        <div style={{ background: T.card, borderRadius: 18, overflow: 'hidden' }}>
          {list.items.map((item, i) => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', minHeight: 52,
              padding: '0 18px', position: 'relative',
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: 11, marginRight: 14, flexShrink: 0,
                background: T.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon.Check s={12}/>
              </div>
              <div style={{
                flex: 1, fontFamily: SF, fontSize: 16, letterSpacing: -0.32,
                color: T.text2,
              }}>
                {item.name}
                {item.qty && (
                  <span style={{ marginLeft: 8, fontSize: 14, color: 'currentColor', opacity: 0.7 }}>{item.qty}</span>
                )}
              </div>
              {i < list.items.length - 1 && (
                <div style={{ position: 'absolute', bottom: 0, left: 54, right: 0, height: 0.5, background: T.sep }}/>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{
        padding: '10px 16px 16px',
        background: T.surfaceBg,
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderTop: `0.5px solid ${T.sep}`,
      }}>
        <button onClick={doReuse} disabled={busy} style={{
          width: '100%', height: 52, borderRadius: 14,
          ...primary,
          fontFamily: SF, fontSize: 17, fontWeight: 600, letterSpacing: -0.4,
          cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {reuseLabel}
        </button>
      </div>

      {confirmDel && (
        <ConfirmSheet
          title="Удалить список?"
          desc={`Список от ${dateForConfirm} будет удалён без возможности восстановления.`}
          confirmLabel="Удалить"
          onConfirm={doDelete}
          onCancel={() => setConfirmDel(false)}
        />
      )}
    </div>
  );
}

// ─── main app ───────────────────────────────────────────────
function ShoppingApp() {
  const [active, setActive] = useState(null);
  const [archiveCount, setArchiveCount] = useState(0);
  const [ingest, setIngest] = useState(null);
  const [view, setView] = useState('list'); // 'list' | 'archive' | 'archiveDetail'
  const [openArchiveId, setOpenArchiveId] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState(null);
  const [archivedFlash, setArchivedFlash] = useState(false);
  const lastIngestId = useRef(null);
  const successHideTimer = useRef(null);

  const refresh = async () => {
    try {
      const data = await fetchState();
      setActive(data.active_list);
      setArchiveCount(data.archive_count || 0);
      setIngest(prev => {
        const next = data.ingest || null;
        if (!next) {
          if (successHideTimer.current) {
            clearTimeout(successHideTimer.current);
            successHideTimer.current = null;
          }
          return null;
        }
        if (next.stage === 'success' && next.id !== lastIngestId.current) {
          lastIngestId.current = next.id;
          if (successHideTimer.current) clearTimeout(successHideTimer.current);
          successHideTimer.current = setTimeout(() => setIngest(null), 2400);
        } else if (next.stage !== 'success') {
          lastIngestId.current = next.id;
          if (successHideTimer.current) {
            clearTimeout(successHideTimer.current);
            successHideTimer.current = null;
          }
        }
        return next;
      });
    } catch (e) {
      console.error('state fetch failed', e);
    }
  };

  useEffect(() => {
    refresh();
    const tick = () => { if (document.visibilityState === 'visible') refresh(); };
    const id = setInterval(tick, 2000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
      if (successHideTimer.current) clearTimeout(successHideTimer.current);
    };
  }, []);

  const onToggle = async (id) => {
    setActive(prev => prev ? {
      ...prev,
      items: prev.items
        .map(it => {
          if (it.id !== id) return it;
          const nextDone = !it.done;
          return {
            ...it,
            done: nextDone,
            checked_at: nextDone ? Math.floor(Date.now() / 1000) : null,
          };
        })
        .sort((a, b) => {
          if (a.done !== b.done) return (a.done ? 1 : 0) - (b.done ? 1 : 0);
          if (a.done) return (b.checked_at || 0) - (a.checked_at || 0);
          return a.position - b.position;
        }),
    } : prev);
    try {
      const r = await toggleItemApi(id);
      if (r.archived) {
        setArchivedFlash(true);
        setTimeout(() => { setArchivedFlash(false); refresh(); }, 1400);
      }
    } catch (e) {
      console.error('toggle failed', e);
      refresh();
    }
  };

  const onSaveEdit = async (updated) => {
    try {
      await patchItemApi(updated.id, { name: updated.name, qty: updated.qty });
      setActive(prev => prev ? {
        ...prev,
        items: prev.items.map(it => it.id === updated.id ? { ...it, name: updated.name, qty: updated.qty } : it),
      } : prev);
    } catch (e) {
      console.error('patch failed', e);
    } finally {
      setEditing(null);
    }
  };

  const onDeleteItem = async (id) => {
    setActive(prev => prev ? { ...prev, items: prev.items.filter(it => it.id !== id) } : prev);
    try {
      await deleteItemApi(id);
    } catch (e) {
      console.error('delete failed', e);
      refresh();
    }
  };

  const onCreate = async () => {
    try {
      await newListApi();
    } catch (e) {
      console.error('new list failed', e);
    }
    closeApp();
  };

  const onArchivePurchased = async () => {
    if (!active) return;
    const listId = active.id;
    setActive(prev => prev ? { ...prev, items: prev.items.filter(it => !it.done) } : prev);
    try {
      await archivePurchasedApi(listId);
    } catch (e) {
      console.error('archive purchased failed', e);
    }
    refresh();
  };

  const items = active ? active.items : [];
  const total = items.length;
  const done = items.filter(i => i.done).length;
  const allDone = total > 0 && done === total;
  const ingestBusy = !!ingest && ingest.stage !== 'success' && ingest.stage !== 'error';

  if (view === 'archiveDetail') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg, position: 'relative' }}>
        <ArchiveDetailScreen
          listId={openArchiveId}
          hasActive={total > 0}
          onBack={() => setView('archive')}
          onAfterReuse={() => { setView('list'); refresh(); }}
          onAfterDelete={() => { setView('archive'); refresh(); }}
        />
      </div>
    );
  }

  if (view === 'archive') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg }}>
        <ArchiveScreen
          onBack={() => setView('list')}
          onOpen={(id) => { setOpenArchiveId(id); setView('archiveDetail'); }}
        />
      </div>
    );
  }

  if (total === 0 && archiveCount === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg, position: 'relative' }}>
        <div style={{ height: 64, flexShrink: 0 }}/>
        <StarterScreen onOpenChat={closeApp}/>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg, position: 'relative' }}>
        <div style={{ height: 64, flexShrink: 0 }}/>
        <EmptyState
          kind="done"
          onCreate={onCreate}
          archiveCount={archiveCount}
          onOpenArchive={() => setView('archive')}
        />
        <StatusBanner ingest={ingest}/>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg, position: 'relative' }}>
      <div style={{ padding: '64px 22px 14px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            fontFamily: SF, fontSize: 28, fontWeight: 700, letterSpacing: -0.5,
            color: T.text, lineHeight: 1.15,
          }}>
            Список покупок
          </div>
          {archiveCount > 0 && (
            <button onClick={() => setView('archive')} style={{
              background: T.pillBg, border: 'none',
              padding: '7px 12px', borderRadius: 14,
              fontFamily: SF, fontSize: 13, color: T.blue, fontWeight: 500,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              flexShrink: 0,
            }}>
              <Icon.Archive s={14}/>
              Архив · {archiveCount}
            </button>
          )}
        </div>
      </div>

      <Progress done={done} total={total} onArchivePurchased={onArchivePurchased}/>

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
              onEdit={(it) => setEditing(it)}
              onDelete={(it) => setConfirmDeleteItem(it)}
              isLast={i === items.length - 1}
              openId={openId}
              setOpenId={setOpenId}
            />
          ))}
        </div>
        {(allDone || archivedFlash) && (
          <div style={{
            textAlign: 'center', padding: '20px 0 8px',
            fontFamily: SF, fontSize: 15, color: T.accent, fontWeight: 500, letterSpacing: -0.24,
          }}>
            ✓ Все товары куплены — переношу в архив...
          </div>
        )}
      </div>

      <StatusBanner ingest={ingest}/>
      <ChatHint busy={ingestBusy}/>

      {editing && <EditSheet item={editing} onClose={() => setEditing(null)} onSave={onSaveEdit}/>}
      {confirmDeleteItem && (
        <ConfirmSheet
          title="Удалить товар?"
          desc={`«${confirmDeleteItem.name}» будет удалён из списка.`}
          confirmLabel="Удалить"
          onConfirm={() => {
            const id = confirmDeleteItem.id;
            setConfirmDeleteItem(null);
            onDeleteItem(id);
          }}
          onCancel={() => setConfirmDeleteItem(null)}
        />
      )}
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
