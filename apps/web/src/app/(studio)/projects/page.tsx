import Link from 'next/link';
import { Icon } from '@/components/icon';
export const metadata = { title: 'Projects' };

export default function ProjectsPage() {
  return <>
    <div className="page-heading"><div><p className="eyebrow">THE STUDIO IS YOURS</p><h1>Make something click.</h1><p className="subtitle">Big ideas. Clear explanations. All in one place.</p></div><Link href="/create" className="button primary"><Icon name="plus" />New video</Link></div>
    <section className="welcome-panel" aria-labelledby="welcome-title"><div className="welcome-copy"><span className="tag lime">FROM CURIOUS TO CLEAR</span><h2 id="welcome-title">Your next explanation<br />starts with a question.</h2><p>A little science. An everyday mystery. Something you wish more people understood.</p><Link href="/create" className="button dark">Start with an idea<Icon name="arrow" /></Link><span className="fine-print">30–90 seconds · Animated · Captioned</span></div>
      <div className="illustration" aria-hidden="true"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><div className="concept-card"><span className="diagram-label">THE MOMENT IT CLICKS</span><div className="diagram"><span className="diagram-dot" /><span className="diagram-line" /><span className="diagram-core"><Icon name="spark" /></span><span className="diagram-line" /><span className="diagram-dot orange" /></div><span className="diagram-caption">A good question changes everything.</span></div><span className="floating-star">✳</span></div>
    </section>
    <section className="projects-section" aria-labelledby="projects-heading"><div className="section-heading"><h2 id="projects-heading">Your projects <span className="count">0</span></h2><span className="muted">A fresh start</span></div><div className="empty-projects"><span className="feature-icon"><Icon name="projects" /></span><h3>A blank canvas, full of possibility.</h3><p>Your saved projects will live here once project storage is connected.</p><Link href="/create" className="text-link">Explore the creation workspace<Icon name="arrow" /></Link></div></section>
    <p className="preview-note">Your session is connected. Project storage is the next studio feature.</p>
  </>;
}
