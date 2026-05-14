import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyTheme } from './theme';
import { lockMiniApp, tg } from './lib/telegram';
import './styles/globals.css';

lockMiniApp(tg);

function syncTheme() {
  const dark = tg
    ? tg.colorScheme === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(dark);
}

syncTheme();
if (tg) tg.onEvent('themeChanged', syncTheme);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncTheme);

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root not found');
// StrictMode is intentionally omitted: it would double-invoke effects in dev
// (polling timer + Telegram init), which adds noise without value here.
createRoot(rootEl).render(<App/>);
