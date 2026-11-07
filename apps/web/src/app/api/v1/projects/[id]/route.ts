import { projectApi,projectBody,projectSuccess,databaseProjectError } from '@/lib/project-api';
import { projectId,projectInput,commandKey,asIdeaProject,lifecycleProjectInput } from '@/lib/project-contract';
type Context={params:Promise<{id:string}>};
export async function DELETE(request:Request,{params}:Context){return projectApi(async(client,requestId)=>{
  const id=projectId((await params).id),input=lifecycleProjectInput(await projectBody(request)),key=commandKey(request.headers.get('idempotency-key'));
  const {data,error}=await client.rpc('trash_idea_project',{p_id:id,p_command:input,p_command_key:key});if(error)databaseProjectError(error);
  return projectSuccess(data,requestId,202);
});}
export async function GET(_request:Request,{params}:Context){return projectApi(async(client,requestId)=>{
  const id=projectId((await params).id),{data,error}=await client.rpc('get_idea_project',{p_id:id});if(error)databaseProjectError(error);
  return projectSuccess(asIdeaProject(data),requestId);
});}
export async function PATCH(request:Request,{params}:Context){return projectApi(async(client,requestId)=>{
  const id=projectId((await params).id),input=projectInput(await projectBody(request),true),key=commandKey(request.headers.get('idempotency-key'));
  const {data,error}=await client.rpc('save_idea_project',{p_id:id,p_command:input,p_command_key:key});if(error)databaseProjectError(error);
  return projectSuccess(asIdeaProject(data),requestId);
});}
