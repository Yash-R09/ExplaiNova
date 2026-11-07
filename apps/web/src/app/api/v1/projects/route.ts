import { projectApi,projectBody,projectSuccess,databaseProjectError } from '@/lib/project-api';
import { projectInput,commandKey,parseProjectCursor,makeProjectCursor,asIdeaProject,asTrashedProject,ProjectError } from '@/lib/project-contract';

export async function GET(request:Request){return projectApi(async(client,requestId)=>{
  const query=new URL(request.url).searchParams;
  if([...query.keys()].some(key=>!['limit','cursor','view'].includes(key))||['limit','cursor','view'].some(key=>query.getAll(key).length>1))throw new ProjectError('VALIDATION_FAILED',400,'Invalid project list query.');
  const view=query.get('view')??'drafts';if(view!=='drafts'&&view!=='trash')throw new ProjectError('VALIDATION_FAILED',400,'Invalid project view.');
  const raw=query.get('limit'),limit=raw===null?20:Number(raw);
  if(!Number.isInteger(limit)||limit<1||limit>50)throw new ProjectError('VALIDATION_FAILED',400,'Choose a page size between 1 and 50.');
  const cursor=parseProjectCursor(query.get('cursor'),view);
  const {data,error}=await client.rpc(view==='trash'?'list_trashed_idea_projects':'list_idea_projects',{p_limit:limit+1,...(cursor?{p_before_at:cursor.updatedAt,p_before_id:cursor.id}:{})});
  if(error)databaseProjectError(error);if(!Array.isArray(data))throw new Error('Invalid library response');
  const all=view==='trash'?data.map(asTrashedProject):data.map(asIdeaProject),rows=all.slice(0,limit),hasMore=all.length>limit;
  return projectSuccess(rows,requestId,200,{hasMore,nextCursor:hasMore?makeProjectCursor(rows.at(-1)!,view):null});
});}
export async function POST(request:Request){return projectApi(async(client,requestId)=>{
  const input=projectInput(await projectBody(request)),key=commandKey(request.headers.get('idempotency-key'));
  const {data,error}=await client.rpc('create_idea_project',{p_command:input,p_command_key:key});if(error)databaseProjectError(error);
  const project=asIdeaProject(data);return projectSuccess(project,requestId,201,{}, {Location:`/api/v1/projects/${project.id}`});
});}
