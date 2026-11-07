import { projectApi,projectBody,projectSuccess,databaseProjectError } from '@/lib/project-api';
import { projectInput,commandKey,parseProjectCursor,makeProjectCursor,asIdeaProject,ProjectError } from '@/lib/project-contract';

export async function GET(request:Request){return projectApi(async(client,requestId)=>{
  const query=new URL(request.url).searchParams;
  if([...query.keys()].some(key=>!['limit','cursor'].includes(key))||query.getAll('limit').length>1||query.getAll('cursor').length>1)throw new ProjectError('VALIDATION_FAILED',400,'Invalid project list query.');
  const raw=query.get('limit'),limit=raw===null?20:Number(raw);
  if(!Number.isInteger(limit)||limit<1||limit>50)throw new ProjectError('VALIDATION_FAILED',400,'Choose a page size between 1 and 50.');
  const cursor=parseProjectCursor(query.get('cursor'));
  const {data,error}=await client.rpc('list_idea_projects',{p_limit:limit+1,...(cursor?{p_before_at:cursor.updatedAt,p_before_id:cursor.id}:{})});
  if(error)databaseProjectError(error);if(!Array.isArray(data))throw new Error('Invalid library response');
  const all=data.map(asIdeaProject),rows=all.slice(0,limit),hasMore=all.length>limit;
  return projectSuccess(rows,requestId,200,{hasMore,nextCursor:hasMore?makeProjectCursor(rows.at(-1)!):null});
});}
export async function POST(request:Request){return projectApi(async(client,requestId)=>{
  const input=projectInput(await projectBody(request)),key=commandKey(request.headers.get('idempotency-key'));
  const {data,error}=await client.rpc('create_idea_project',{p_command:input,p_command_key:key});if(error)databaseProjectError(error);
  const project=asIdeaProject(data);return projectSuccess(project,requestId,201,{}, {Location:`/api/v1/projects/${project.id}`});
});}
