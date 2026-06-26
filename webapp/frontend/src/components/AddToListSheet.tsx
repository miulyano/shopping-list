import { useLayoutEffect, useRef, useState } from 'react';
import { T } from '../theme';
import { SF } from '../lib/constants';
import { Icon } from '../icons';
import { pluralRu } from '../lib/format';
import { usePrimary } from '../lib/primary';
import type { ApiList, NamedList } from '../types';

interface Props {
  list: ApiList;
  lists: NamedList[];
  onClose: () => void;
  onAdd: (targetId: number, itemIds: number[]) => void;
}

/** Bottom sheet to add items from an archived list back into a named list,
 *  choosing the destination and an optional subset of items. */
export function AddToListSheet({ list, lists, onClose, onAdd }: Props) {
  const firstId = lists[0]?.id ?? 0;
  const [sel, setSel] = useState<number>(list.named_list_id ?? firstId);
  const [mode, setMode] = useState<'main' | 'edit'>('main');
  const [excluded, setExcluded] = useState<Set<number>>(() => new Set()); // committed
  const [draft, setDraft] = useState<Set<number>>(() => new Set()); // while editing
  const primary = usePrimary();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [lockH, setLockH] = useState<number | null>(null);

  // Capture the main-screen height once, then keep the popup that tall so
  // switching into the edit screen doesn't resize the sheet.
  useLayoutEffect(() => {
    if (sheetRef.current && lockH == null) setLockH(sheetRef.current.offsetHeight);
  }, [lockH]);

  const picked = list.items.filter((it) => !excluded.has(it.id));
  const count = picked.length;
  const selColor = (lists.find((l) => l.id === sel) || {}).color || T.blue;

  const openEdit = () => {
    setDraft(new Set(excluded));
    setMode('edit');
  };
  const cancelEdit = () => setMode('main'); // discard draft
  const commitEdit = () => {
    setExcluded(new Set(draft));
    setMode('main');
  };
  const toggleDraft = (id: number) =>
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const confirm = () => {
    if (count > 0) onAdd(sel, picked.map((it) => it.id));
  };

  const sheetHeader = (left: React.ReactNode, title: string, right: React.ReactNode) => (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 16, flexShrink: 0,
    }}>
      {left}
      <div style={{ fontFamily: SF, fontSize: 17, fontWeight: 600, color: T.text, letterSpacing: -0.4 }}>
        {title}
      </div>
      {right}
    </div>
  );
  const txtBtn = (label: string, onClick: () => void, align: 'left' | 'right', bold: boolean) => (
    <button onClick={onClick} style={{
      background: 'none', border: 'none', padding: '6px 0', minWidth: 80,
      textAlign: align,
      fontFamily: SF, fontSize: 17, color: T.blue, cursor: 'pointer',
      letterSpacing: -0.4, fontWeight: bold ? 600 : 400,
    }}>{label}</button>
  );

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      display: 'flex', alignItems: 'flex-end',
      background: 'rgba(0,0,0,0.4)', animation: 'fade 0.2s ease',
    }} onClick={onClose}>
      <div ref={sheetRef} onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxHeight: '92%', height: lockH || undefined,
        display: 'flex', flexDirection: 'column',
        background: T.bg,
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: '10px 16px 20px', boxSizing: 'border-box',
        animation: 'slideUp 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
      }}>
        <div style={{ width: 40, height: 5, borderRadius: 3, background: T.text3, margin: '0 auto 12px', flexShrink: 0 }}/>

        {mode === 'edit' ? (
          // ── EDIT SCREEN — select items, no «add» button ──
          <>
            {sheetHeader(
              txtBtn('Отмена', cancelEdit, 'left', false),
              'Выбор товаров',
              txtBtn('Готово', commitEdit, 'right', true),
            )}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0 4px 8px', gap: 12,
            }}>
              <span style={{
                fontFamily: SF, fontSize: 11.5, fontWeight: 600, color: T.text2,
                letterSpacing: 0.3, textTransform: 'uppercase',
              }}>Товары</span>
              <span style={{
                fontFamily: SF, fontSize: 11.5, fontWeight: 600, color: T.text3,
                letterSpacing: 0.3, textTransform: 'uppercase', fontVariantNumeric: 'tabular-nums',
              }}>Выбрано {list.items.length - draft.size} из {list.items.length}</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              <div style={{ background: T.card, borderRadius: 14, overflow: 'hidden' }}>
                {list.items.map((item, i) => {
                  const included = !draft.has(item.id);
                  return (
                    <button key={item.id} onClick={() => toggleDraft(item.id)} style={{
                      width: '100%', border: 'none', background: 'transparent', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 12,
                      minHeight: 50, padding: '0 16px', position: 'relative',
                      textAlign: 'left', WebkitTapHighlightColor: 'transparent',
                    }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: 11, flexShrink: 0, boxSizing: 'border-box',
                        background: included ? T.accent : 'transparent',
                        border: `1.6px solid ${included ? 'transparent' : T.text3}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.18s ease, border-color 0.18s ease',
                      }}>
                        {included && <Icon.Check s={12}/>}
                      </span>
                      <span style={{
                        flex: 1, minWidth: 0, fontFamily: SF, fontSize: 16, letterSpacing: -0.32,
                        color: included ? T.text : T.text2,
                        opacity: included ? 1 : 0.55, transition: 'color 0.18s, opacity 0.18s',
                      }}>
                        {item.name}
                        {item.qty && <span style={{ marginLeft: 8, fontSize: 14, color: T.text2 }}>{item.qty}</span>}
                      </span>
                      {i < list.items.length - 1 && (
                        <div style={{ position: 'absolute', bottom: 0, left: 50, right: 0, height: 0.5, background: T.sep }}/>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          // ── MAIN SCREEN — pick destination list + add ──
          <>
            {sheetHeader(
              txtBtn('Отмена', onClose, 'left', false),
              'Добавить из архива',
              <div style={{ minWidth: 80 }}/>,
            )}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {/* items preview plate — icon button opens the edit screen */}
              <div style={{ background: T.card, borderRadius: 14, padding: '12px 14px 13px', marginBottom: 18 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  gap: 10, marginBottom: 7,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ fontFamily: SF, fontSize: 16, fontWeight: 600, color: T.text, letterSpacing: -0.3 }}>
                      Товары
                    </span>
                    <span style={{
                      minWidth: 22, height: 22, padding: '0 7px', borderRadius: 11,
                      background: selColor + '22', color: selColor,
                      fontFamily: SF, fontSize: 13, fontWeight: 700,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontVariantNumeric: 'tabular-nums', boxSizing: 'border-box',
                      transition: 'background 0.2s ease, color 0.2s ease',
                    }}>{count}</span>
                  </div>
                  <button onClick={openEdit} aria-label="Изменить товары" style={{
                    width: 30, height: 30, borderRadius: 15, flexShrink: 0,
                    background: T.blue + '1F', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    WebkitTapHighlightColor: 'transparent',
                  }}>
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                      <path d="M3 14.5L13.5 4l3 3L6 17.5H3v-3z" stroke={T.blue} strokeWidth="1.7" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
                {count === 0 ? (
                  <div style={{ fontFamily: SF, fontSize: 15, color: T.text3, letterSpacing: -0.24 }}>
                    Товары не выбраны
                  </div>
                ) : (
                  <div style={{
                    fontFamily: SF, fontSize: 15, color: T.text2, letterSpacing: -0.24, lineHeight: 1.45,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>{picked.map((it) => it.name).join(', ')}</div>
                )}
              </div>

              <div style={{
                fontFamily: SF, fontSize: 11.5, fontWeight: 600, color: T.text2,
                letterSpacing: 0.3, textTransform: 'uppercase', padding: '0 4px 8px',
              }}>Добавить в список</div>

              <div style={{ background: T.card, borderRadius: 14, overflow: 'hidden' }}>
                {lists.map((l, i) => {
                  const active = sel === l.id;
                  return (
                    <button key={l.id} onClick={() => setSel(l.id)} style={{
                      width: '100%', border: 'none', background: 'transparent', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 11,
                      minHeight: 52, padding: '0 16px', position: 'relative',
                      fontFamily: SF, fontSize: 17, letterSpacing: -0.4, color: T.text, textAlign: 'left',
                    }}>
                      <span style={{ width: 10, height: 10, borderRadius: 5, flexShrink: 0, background: l.color || T.text3 }}/>
                      <span style={{ flex: 1 }}>{l.name}</span>
                      {active && (
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                          <path d="M3.5 9.5l3.5 3.5L14.5 5" stroke={T.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                      {i < lists.length - 1 && (
                        <div style={{ position: 'absolute', bottom: 0, left: 37, right: 0, height: 0.5, background: T.sep }}/>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* primary action — reflects how many items will be added */}
            <button onClick={confirm} disabled={count === 0} style={{
              width: '100%', height: 52, borderRadius: 14, marginTop: 16, flexShrink: 0,
              ...primary,
              opacity: count === 0 ? 0.4 : 1,
              fontFamily: SF, fontSize: 17, fontWeight: 600, letterSpacing: -0.4,
              cursor: count === 0 ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {count === 0
                ? 'Выберите товары'
                : `Добавить ${count} ${pluralRu(count, ['товар', 'товара', 'товаров'])}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
