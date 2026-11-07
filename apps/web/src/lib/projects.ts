import 'server-only';
import { requireIdentity } from './session';
import { createClient } from './supabase/server';
import { databaseProjectError } from './project-api';
import { asIdeaProject,asTrashedProject,parseProjectCursor,makeProjectCursor,projectId,projectSearch,type ProjectView } from './project-contract';

export async function ownedIdeaProject(id:string){
  await requireIdentity();const client=await createClient();if(!client)throw new Error('Draft service unavailable');
  const {data,error}=await client.rpc('get_idea_project',{p_id:projectId(id)});if(error)databaseProjectError(error);return asIdeaProject(data);
}
async function ownedLibraryRows(value:unknown,rawQuery:unknown,view:ProjectView){
  await requireIdentity();const query=projectSearch(rawQuery),cursor=parseProjectCursor(value,view,query),client=await createClient();if(!client)throw new Error('Draft service unavailable');
  const bounds={p_limit:21,...(cursor?{p_before_at:cursor.updatedAt,p_before_id:cursor.id}:{})};
  const {data,error}=query?await client.rpc('search_idea_projects',{p_query:query,p_trashed:view==='trash',...bounds}):await client.rpc(view==='trash'?'list_trashed_idea_projects':'list_idea_projects',bounds);if(error)databaseProjectError(error);
  if(!Array.isArray(data))throw new Error('Draft service unavailable');
  return {data,query};
}
export async function ownedIdeaLibrary(value:unknown,rawQuery?:unknown){
  const {data,query}=await ownedLibraryRows(value,rawQuery,'drafts'),all=data.map(asIdeaProject),rows=all.slice(0,20);
  return {rows,query,nextCursor:all.length>20?makeProjectCursor(rows.at(-1)!,'drafts',query):null};
}
export async function ownedTrashLibrary(value:unknown,rawQuery?:unknown){
  const {data,query}=await ownedLibraryRows(value,rawQuery,'trash'),all=data.map(asTrashedProject),rows=all.slice(0,20);
  return {rows,query,nextCursor:all.length>20?makeProjectCursor(rows.at(-1)!,'trash',query):null};
}
