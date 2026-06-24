import { T } from '../theme';
import { SF } from '../lib/constants';
import { Icon } from '../icons';
import { usePrimary } from '../lib/primary';

interface Props {
  kind: 'done' | 'empty';
  onCreate: () => void;
  archiveCount: number;
  onOpenArchive: () => void;
}

export function EmptyState({ kind, onCreate, archiveCount, onOpenArchive }: Props) {
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
        {isDone ? 'Новый список' : 'Добавить товары'}
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
