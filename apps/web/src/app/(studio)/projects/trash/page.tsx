import Link from 'next/link';
import {ownedTrashLibrary} from '@/lib/projects';
import {ProjectError,projectLibraryHref} from '@/lib/project-contract';
import {LibrarySearch} from '@/components/library-search';
import {DraftLifecycleButton} from '@/components/draft-lifecycle-button';
export const metadata={title:'Trash'};
export default async function TrashPage({searchParams}:{searchParams:Promise<{cursor?:string|string[];q?:string|string[]}>}){
 const params=await searchParams;let library;
 try{library=await ownedTrashLibrary(params.cursor,params.q);}catch(error){if(error instanceof ProjectError&&error.status===400)return <section className="placeholder-panel"><h1>Open Trash again.</h1><p>This search or page link is no longer valid.</p><Link className="button primary" href="/projects/trash">Open first page</Link></section>;throw error;}
 return <><Link href={projectLibraryHref('drafts',library.query)} className="draft-back">← Your idea drafts</Link><div className="page-heading"><div><p className="eyebrow">ROOM FOR YOUR NEXT IDEA</p><h1>Trash</h1><p className="subtitle">Restore a saved draft whenever you need it again.</p></div></div>
 <LibrarySearch view="trash" query={library.query} />{library.rows.length?<div className="draft-grid">{library.rows.map(project=><article className="draft-card trash-card" key={`${project.id}:${project.revision}`}><span className="tag">IN TRASH</span><h2>{project.title}</h2><p className="muted">Moved to Trash {project.deletedAt.slice(0,10)} · revision {project.revision}</p><DraftLifecycleButton {...project} mode="restore" returnTo={projectLibraryHref('trash',library.query)} /></article>)}</div>:library.query?<section className="empty-projects"><h2>No matching drafts in Trash.</h2><p>Try a different title or clear your search.</p><Link className="button secondary" href="/projects/trash">Clear search</Link></section>:<section className="empty-projects"><h2>Nothing in Trash.</h2><p>Drafts you move here can be restored to your library.</p><Link href="/projects" className="button secondary">Back to projects</Link></section>}
 <div className="library-pagination">{params.cursor?<Link className="button secondary" href={projectLibraryHref('trash',library.query)}>First page</Link>:null}{library.nextCursor?<Link className="button secondary" href={projectLibraryHref('trash',library.query,library.nextCursor)}>Older drafts</Link>:null}</div>
 <p className="preview-note">Moving a draft to Trash keeps its saved content and history. Permanent deletion is not available in this version.</p></>;
}
