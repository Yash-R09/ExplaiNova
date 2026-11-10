import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StoryboardEditor } from '@/components/storyboard-editor';
import { projectId, ProjectError } from '@/lib/project-contract';
import { requireIdentity } from '@/lib/session';
import { readStoryboard } from '@/lib/storyboards';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Storyboard review' };

export default async function StoryboardReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireIdentity();
  const client = await createClient();
  if (!client) throw new Error('Storyboard service unavailable');
  const storyboard = await (async () => {
    try { return await readStoryboard(client, projectId((await params).id)); }
    catch (error) {
      if (error instanceof ProjectError && (error.status === 400 || error.status === 404)) notFound();
      throw error;
    }
  })();
  return <>
    <Link href={`/projects/${storyboard.projectId}`} className="draft-back">← Back to your idea</Link>
    <div className="page-heading"><div><p className="eyebrow">STORYBOARD REVIEW</p><h1>Shape the explanation.</h1>
      <p className="subtitle">Review the scenes and refine the narration before moving to video.</p></div>
      <ol className="stepper" aria-label="Creation workflow"><li>1. Plan</li><li aria-current="step">2. Storyboard</li><li>3. Video</li></ol>
    </div>
    <StoryboardEditor key={`${user.id}:${storyboard.id}`} initial={storyboard} ownerId={user.id} />
  </>;
}
