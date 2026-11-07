import Link from 'next/link';
import {projectLibraryHref,type ProjectView} from '@/lib/project-contract';
import {TitleSearchInput} from './title-search-input';
export function LibrarySearch({view,query}:{view:ProjectView;query:string}){
 return <form key={`${view}:${query}`} role="search" aria-label={view==='trash'?'Search Trash titles':'Search draft titles'} method="get" action={projectLibraryHref(view)} className="library-search">
  <label htmlFor={`${view}-title-search`}>Search titles</label>
  <div className="library-search-controls"><TitleSearchInput id={`${view}-title-search`} query={query} /><button type="submit" className="button primary">Search</button>{query?<Link className="button secondary" href={projectLibraryHref(view)}>Clear search</Link>:null}</div>
  {query?<p className="muted" role="status">Results for “{query}” · recently updated first</p>:null}
 </form>;
}
