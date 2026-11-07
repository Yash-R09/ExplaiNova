'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Icon, type IconName } from './icon';
import { signOut } from '@/app/sign-in/actions';

const navigation: { href: string; label: string; icon: IconName }[] = [
  { href: '/projects', label: 'Projects', icon: 'projects' },
  { href: '/publishing', label: 'Publishing', icon: 'publishing' },
  { href: '/connections', label: 'Connected accounts', icon: 'accounts' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
];

export function AppShell({ children, email }: { children: ReactNode; email: string }) {
  const pathname = usePathname();
  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <aside className="sidebar">
      <Link href="/projects" className="brand" aria-label="Explainova projects"><span className="brand-mark"><Icon name="spark" /></span><span>Explainova<small>THE EXPLAINER STUDIO</small></span></Link>
      <Link className="button primary create-link" href="/create"><Icon name="plus" />Create video</Link>
      <nav aria-label="Main navigation">{navigation.map(item => {
        const active = pathname === item.href || (item.href === '/projects' && pathname.startsWith('/create'));
        return <Link key={item.href} href={item.href} className={`nav-link${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}><Icon name={item.icon} /><span>{item.label}</span></Link>;
      })}</nav>
      <div className="sidebar-note"><span className="status-dot" />Your private studio<small>Social accounts connect separately</small></div>
    </aside>
    <div className="main-column">
      <header className="topbar"><span>YOUR CREATIVE WORKSPACE</span><div className="session-controls"><span className="session-email" title={email}>{email}</span><form action={signOut}><button type="submit" className="sign-out">Sign out</button></form></div></header>
      <main id="main" tabIndex={-1}>{children}</main>
    </div>
  </div>;
}
