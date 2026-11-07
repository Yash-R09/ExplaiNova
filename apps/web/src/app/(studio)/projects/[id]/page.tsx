import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ownedIdeaProject } from '@/lib/projects';
import { ProjectError } from '@/lib/project-contract';
import { IdeaDraftEditor } from '@/components/idea-draft-editor';
import { requireIdentity } from '@/lib/session';
export const metadata={title:'Idea draft'};
export default async function IdeaDraftPage({params}:{params:Promise<{id:string}>}){
  const identity=await requireIdentity();let project;
  try{project=await ownedIdeaProject((await params).id);}catch(error){if(error instanceof ProjectError&&[400,404].includes(error.status))notFound();throw error;}
  return <><Link href="/projects" className="draft-back">← Your idea drafts</Link><div className="page-heading"><div><p className="eyebrow">A GOOD IDEA STARTS HERE</p><h1>Shape your idea.</h1><p className="subtitle">Keep the thought. Build the explanation when you’re ready.</p></div><ol className="stepper" aria-label="Creation workflow"><li aria-current="step">1. Plan</li><li>2. Storyboard</li><li>3. Video</li></ol></div><IdeaDraftEditor key={`${identity.user.id}:${project.id}`} project={project} ownerId={identity.user.id} /></>;
}
