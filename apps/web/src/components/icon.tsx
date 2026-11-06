import type { CSSProperties } from 'react';

export type IconName = 'projects' | 'publishing' | 'accounts' | 'settings' | 'plus' | 'arrow' | 'spark' | 'play';
const paths: Record<IconName, string> = {
  projects: 'M3 7h7l2 2h9v11H3V7zm0 0V4h7l2 3',
  publishing: 'm4 4 17 8-17 8 4-8-4-8zm4 8h13',
  accounts: 'm9 15 6-6M8 17l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 8a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-1 1',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm-2-5h4l1 3 3 1 3 3v4l-3 1-1 3-3 3h-4l-1-3-3-1-3-3v-4l3-1 1-3 3-3z',
  plus: 'M12 5v14M5 12h14',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3z',
  play: 'm9 5 11 7-11 7V5z',
};

export function Icon({ name, style }: { name: IconName; style?: CSSProperties }) {
  return <svg style={style} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
