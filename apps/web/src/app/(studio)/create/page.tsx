import Link from 'next/link';
import { Icon } from '@/components/icon';
import { CreateDraftButton } from '@/components/create-draft-button';
export const metadata = { title: 'Create video' };
export default function CreatePage() {
  return <><div className="page-heading"><div><p className="eyebrow">A GOOD IDEA STARTS HERE</p><h1>Create — Plan</h1><p className="subtitle">One idea. Three simple steps.</p></div><ol className="stepper" aria-label="Creation workflow"><li aria-current="step">1. Plan</li><li>2. Storyboard</li><li>3. Video</li></ol></div>
    <section className="placeholder-panel"><span className="feature-icon"><Icon name="spark" /></span><h2>Start with a small spark.</h2><p>Create a private draft for your idea and reference notes. You can save it, leave, and return whenever you’re ready.</p><CreateDraftButton>Create idea draft</CreateDraftButton><p className="muted">AI planning and video generation will follow. Creating a draft makes no AI requests.</p><Link href="/projects" className="text-link">Back to projects<Icon name="arrow" /></Link></section></>;
}
