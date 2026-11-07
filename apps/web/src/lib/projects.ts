import 'server-only';
import { requireIdentity } from './session';
import { createClient } from './supabase/server';
import { databaseProjectError } from './project-api';
import { asIdeaProject,asTrashedProject,parseProjectCursor,makeProjectCursor,projectId } from './project-contract';

export async function ownedIdeaProject(id:string){
  await requireIdentity();const client=await createClient();if(!client)throw new Error('Draft service unavailable');
  const {data,error}=await client.rpc('get_idea_project',{p_id:projectId(id)});if(error)databaseProjectError(error);return asIdeaProject(data);
}
export async function ownedIdeaLibrary(value:unknown){
  await requireIdentity();const cursor=parseProjectCursor(value),client=await createClient();if(!client)throw new Error('Draft service unavailable');
  const {data,error}=await client.rpc('list_idea_projects',{p_limit:21,...(cursor?{p_before_at:cursor.updatedAt,p_before_id:cursor.id}:{})});if(error)databaseProjectError(error);
  if(!Array.isArray(data))throw new Error('Draft service unavailable');
  const all=data.map(asIdeaProject),rows=all.slice(0,20);return {rows,nextCursor:all.length>20?makeProjectCursor(rows.at(-1)!):null};
}
export async function ownedTrashLibrary(value:unknown){
  await requireIdentity();const cursor=parseProjectCursor(value,'trash'),client=await createClient();if(!client)throw new Error('Draft service unavailable');
  const {data,error}=await client.rpc('list_trashed_idea_projects',{p_limit:21,...(cursor?{p_before_at:cursor.updatedAt,p_before_id:cursor.id}:{})});if(error)databaseProjectError(error);
  if(!Array.isArray(data))throw new Error('Trash unavailable');
  const all=data.map(asTrashedProject),rows=all.slice(0,20);return {rows,nextCursor:all.length>20?makeProjectCursor(rows.at(-1)!,'trash'):null};
}
