import {projectApi,projectBody,projectSuccess,databaseProjectError} from '@/lib/project-api';
import {projectId,lifecycleProjectInput,commandKey,asIdeaProject} from '@/lib/project-contract';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){return projectApi(async(client,requestId)=>{
 const id=projectId((await params).id),input=lifecycleProjectInput(await projectBody(request)),key=commandKey(request.headers.get('idempotency-key'));
 const {data,error}=await client.rpc('restore_idea_project',{p_id:id,p_command:input,p_command_key:key});if(error)databaseProjectError(error);
 return projectSuccess(asIdeaProject(data),requestId);
});}
