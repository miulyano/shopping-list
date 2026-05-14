import { T } from '../theme';
import { SF } from '../lib/constants';
import { Icon } from '../icons';
import type { ApiIngest } from '../types';

interface Props {
  ingest: ApiIngest | null;
}

export function StatusBanner({ ingest }: Props) {
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
      {[0, 1, 2, 3].map((i) => (
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
