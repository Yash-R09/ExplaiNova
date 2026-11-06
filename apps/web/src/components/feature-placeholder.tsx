import Link from 'next/link';
import { Icon, type IconName } from './icon';

export function FeaturePlaceholder({ title, description, milestone, icon }: { title: string; description: string; milestone: string; icon: IconName }) {
  return <><div className="page-heading"><div><p className="eyebrow">COMING NEXT</p><h1>{title}</h1><p className="subtitle">{description}</p></div></div>
    <section className="placeholder-panel"><span className="feature-icon"><Icon name={icon} /></span><span className="tag">{milestone}</span><h2>A place for what’s next.</h2><p>This page is part of the app foundation. Its features will become available in a later milestone.</p><Link className="button secondary" href="/projects">Back to projects<Icon name="arrow" /></Link></section></>;
}
