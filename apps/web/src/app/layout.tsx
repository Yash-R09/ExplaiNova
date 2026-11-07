import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = { title: { default: 'Explainova — Your explainer studio', template: '%s | Explainova' }, description: 'Turn a good idea into a clear, animated explanation.' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
