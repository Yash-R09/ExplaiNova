import Link from 'next/link';
import { Icon } from '@/components/icon';
import { CreateDraftButton } from '@/components/create-draft-button';
import { ownedIdeaLibrary } from '@/lib/projects';
import { DuplicateDraftButton } from '@/components/duplicate-draft-button';
import { DraftLifecycleButton } from '@/components/draft-lifecycle-button';
import { ProjectError,projectLibraryHref } from '@/lib/project-contract';
import { LibrarySearch } from '@/components/library-search';
export const metadata = { title: 'Projects' };

export default async function ProjectsPage({searchParams}:{searchParams:Promise<{cursor?:string|string[];q?:string|string[]}>}) {
  const params=await searchParams;let library;
  try{library=await ownedIdeaLibrary(params.cursor,params.q);}catch(error){if(error instanceof ProjectError&&error.status===400)return <section className="placeholder-panel"><h1>Let’s open your library again.</h1><p>The search or page link is no longer valid.</p><Link href="/projects" className="button primary">Open first page</Link></section>;throw error;}
  return <>
    <div className="page-heading"><div><p className="eyebrow">THE STUDIO IS YOURS</p><h1>Make something click.</h1><p className="subtitle">Big ideas. Clear explanations. All in one place.</p></div><div className="library-heading-actions"><Link href={projectLibraryHref('trash',library.query)} className="button secondary">Trash</Link><CreateDraftButton>New draft</CreateDraftButton></div></div>
    <section className="welcome-panel" aria-labelledby="welcome-title"><div className="welcome-copy"><span className="tag lime">FROM CURIOUS TO CLEAR</span><h2 id="welcome-title">Your next explanation<br />starts with a question.</h2><p>A little science. An everyday mystery. Something you wish more people understood.</p><Link href="/create" className="button dark">Start with an idea<Icon name="arrow" /></Link><span className="fine-print">30–90 seconds · Animated · Captioned</span></div>
      <div className="illustration" aria-hidden="true"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><div className="concept-card"><span className="diagram-label">THE MOMENT IT CLICKS</span><div className="diagram"><span className="diagram-dot" /><span className="diagram-line" /><span className="diagram-core"><Icon name="spark" /></span><span className="diagram-line" /><span className="diagram-dot orange" /></div><span className="diagram-caption">A good question changes everything.</span></div><span className="floating-star">✳</span></div>
    </section>
    <section className="projects-section" aria-labelledby="projects-heading"><div className="section-heading"><h2 id="projects-heading">Your idea drafts</h2><span className="muted">Recently updated</span></div><LibrarySearch view="drafts" query={library.query} />{library.rows.length?<div className="draft-grid">{library.rows.map(project=><article className="draft-card" key={project.id}><Link className="draft-card-open" href={`/projects/${project.id}`}><div className="draft-card-art"><Icon name="spark" /><span className="tag">IDEA DRAFT</span></div><h3>{project.title}</h3><p>{project.brief.trim()||'A blank canvas, full of possibility.'}</p><div className="field-meta"><span>{project.targetDurationMs/1000}s target</span><span>Updated {project.updatedAt.slice(0,10)}</span></div></Link><DuplicateDraftButton id={project.id} title={project.title} revision={project.revision} /><DraftLifecycleButton id={project.id} title={project.title} revision={project.revision} mode="trash" returnTo={projectLibraryHref('drafts',library.query)} /></article>)}</div>:library.query?<div className="empty-projects"><h3>No matching drafts.</h3><p>Try a different title or clear your search.</p><Link className="button secondary" href="/projects">Clear search</Link></div>:<div className="empty-projects"><span className="feature-icon"><Icon name="projects" /></span><h3>A blank canvas, full of possibility.</h3><p>Start an idea, save a thought, and return whenever inspiration strikes.</p><CreateDraftButton className="button secondary">Create your first draft</CreateDraftButton></div>}</section>
    <div className="library-pagination">{params.cursor?<Link className="button secondary" href={projectLibraryHref('drafts',library.query)}>First page</Link>:null}{library.nextCursor?<Link className="button secondary" href={projectLibraryHref('drafts',library.query,library.nextCursor)}>Older drafts<Icon name="arrow" /></Link>:null}</div>
    <p className="preview-note">Your drafts are private. Open a draft to keep shaping your idea.</p>
  </>;
}
