import Link from 'next/link';
import { Icon } from '@/components/icon';
export const metadata = { title: 'Create video' };
export default function CreatePage() {
  return <><div className="page-heading"><div><p className="eyebrow">A GOOD IDEA STARTS HERE</p><h1>Create — Plan</h1><p className="subtitle">One idea. Three simple steps.</p></div><ol className="stepper" aria-label="Creation workflow"><li aria-current="step">1. Plan</li><li>2. Storyboard</li><li>3. Video</li></ol></div>
    <section className="placeholder-panel"><span className="feature-icon"><Icon name="spark" /></span><span className="tag">MILESTONE 4</span><h2>First, the foundation.<br />Then, your next big idea.</h2><p>The planning workspace will collect your topic, duration, narration voice, and reference notes. AI will turn them into a storyboard for your approval.</p><p className="muted">Idea entry will be enabled when saving and authentication are ready.</p><Link href="/projects" className="button secondary">Back to projects<Icon name="arrow" /></Link></section></>;
}
