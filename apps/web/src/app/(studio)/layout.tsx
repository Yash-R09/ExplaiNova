import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import { requireIdentity } from '@/lib/session';

export default async function StudioLayout({ children }: { children: ReactNode }) {
  const { user } = await requireIdentity();
  return <AppShell email={user.email ?? 'Your studio'}>{children}</AppShell>;
}
