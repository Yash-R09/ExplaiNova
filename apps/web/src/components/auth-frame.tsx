import type { ReactNode } from 'react';
import { Icon } from './icon';

export function AuthFrame({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: string; children: ReactNode }) {
  return <div className="auth-page">
    <section className="auth-editorial" aria-label="Explainova studio">
      <div className="brand"><span className="brand-mark"><Icon name="spark" /></span><span>Explainova<small>THE EXPLAINER STUDIO</small></span></div>
      <div><span className="tag lime">MAKE IT MAKE SENSE</span><h1>Good ideas deserve<br />a clear explanation.</h1><p>Your ideas, storyboards, and next “aha” moment. Together in your own studio.</p></div>
      <span className="auth-art" aria-hidden="true">✳</span>
      <p className="auth-footnote">A little curiosity goes a long way.</p>
    </section>
    <main className="auth-content" id="main"><div className="auth-card"><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p className="subtitle">{subtitle}</p>{children}</div></main>
  </div>;
}
