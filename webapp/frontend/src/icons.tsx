import { T } from './theme';

interface IconProps {
  s?: number;
  c?: string;
}

export const Plus = ({ s = 22, c }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 22 22" fill="none">
    <path d="M11 4v14M4 11h14" stroke={c || T.text} strokeWidth="2.2" strokeLinecap="round"/>
  </svg>
);

export const Mic = ({ s = 20, c }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
    <rect x="7" y="2.5" width="6" height="11" rx="3" stroke={c || T.text2} strokeWidth="1.7"/>
    <path d="M4 9.5a6 6 0 0012 0M10 15.5v3" stroke={c || T.text2} strokeWidth="1.7" strokeLinecap="round"/>
  </svg>
);

export const Camera = ({ s = 20, c }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
    <path d="M2.5 7.5a2 2 0 012-2h1.6l1-1.5h5.8l1 1.5h1.6a2 2 0 012 2v7a2 2 0 01-2 2h-11a2 2 0 01-2-2v-7z" stroke={c || T.text2} strokeWidth="1.6"/>
    <circle cx="10" cy="11" r="3" stroke={c || T.text2} strokeWidth="1.6"/>
  </svg>
);

export const Close = ({ s = 18, c }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 18 18" fill="none">
    <path d="M5 5l8 8M13 5l-8 8" stroke={c || T.text2} strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);

export const Chevron = ({ s = 12, c }: IconProps) => (
  <svg width={(s / 12) * 8} height={s} viewBox="0 0 8 12" fill="none">
    <path d="M1.5 1l5 5-5 5" stroke={c || T.text3} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const Check = ({ s = 14, c = '#fff' }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
    <path d="M3 7.2l2.8 2.8L11 4.5" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const CheckBig = ({ s = 36, c }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 36 36" fill="none">
    <path d="M9 18.5l6 6 12-13" stroke={c || T.accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const Cart = ({ s = 38, c }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 38 38" fill="none">
    <path d="M5 7h4l2.5 17a2 2 0 002 1.7h13.5a2 2 0 002-1.6L31 12H10.5" stroke={c || T.text3} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="14" cy="31" r="2" stroke={c || T.text3} strokeWidth="1.8"/>
    <circle cx="27" cy="31" r="2" stroke={c || T.text3} strokeWidth="1.8"/>
  </svg>
);

export const Archive = ({ s = 18, c }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 18 18" fill="none">
    <rect x="2" y="3" width="14" height="3.5" rx="1" stroke={c || T.blue} strokeWidth="1.6"/>
    <path d="M3 6.5v7.5a1.5 1.5 0 001.5 1.5h9A1.5 1.5 0 0015 14V6.5M7 9.5h4" stroke={c || T.blue} strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);

// eslint-disable-next-line react-refresh/only-export-components
export const Icon = { Plus, Mic, Camera, Close, Chevron, Check, CheckBig, Cart, Archive };
