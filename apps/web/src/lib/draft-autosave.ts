import type { IdeaProject } from './project-contract';

export type DraftFields = { title:string; brief:string; referenceText:string };
type Operation = { key:string; revision:number; fields:DraftFields };
type Backup = { schema:1; ownerId:string; projectId:string; revision:number; fields:DraftFields; operation:Operation|null; updatedAt:string };
export type Recovery = { key:string; raw:string; backup:Backup };
type StoragePort = Pick<Storage,'length'|'key'|'getItem'|'setItem'|'removeItem'>;
type Reply = { ok:boolean; status:number; json():Promise<unknown> };
type Transport = (url:string,options?:RequestInit)=>Promise<Reply>;
export type AutosaveView = {
  fields:DraftFields; revision:number; dirty:boolean;
  status:'saved'|'pending'|'saving'|'offline'|'error'|'conflict'|'recovery';
  message:string; storageWarning:boolean; recoveries:Recovery[]; remote:IdeaProject|null; comparing:boolean;
};
const fieldsOf=(p:DraftFields):DraftFields=>({title:p.title,brief:p.brief,referenceText:p.referenceText});
const equal=(a:DraftFields,b:DraftFields)=>a.title===b.title&&a.brief===b.brief&&a.referenceText===b.referenceText;
function validFields(value:unknown):value is DraftFields {
  if(!value||typeof value!=='object')return false;
  const p=value as DraftFields;
  return typeof p.title==='string'&&p.title.length<=140&&typeof p.brief==='string'&&p.brief.length<=6000&&typeof p.referenceText==='string'&&p.referenceText.length<=20000;
}
function validRevision(value:unknown):value is number{return Number.isInteger(value)&&Number(value)>0&&Number(value)<=2147483647;}
function readBackup(raw:string,ownerId:string,projectId:string):Backup|null {
  try{
    if(raw.length>150000)return null;
    const b=JSON.parse(raw) as Backup;
    if(b.schema!==1||b.ownerId!==ownerId||b.projectId!==projectId||!validRevision(b.revision)||!validFields(b.fields)||typeof b.updatedAt!=='string'||!Number.isFinite(Date.parse(b.updatedAt)))return null;
    if(b.operation!==null&&(!b.operation||!validRevision(b.operation.revision)||typeof b.operation.key!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(b.operation.key)||!validFields(b.operation.fields)))return null;
    return b;
  }catch{return null;}
}

// Each mounted editor owns a separate backup, so another tab cannot overwrite
// its pending text. Only text/revisions/request IDs are stored, never credentials.
export class DraftAutosave {
  private project:IdeaProject;
  private ownerId:string;
  private transport:Transport;
  private storage:StoragePort|null;
  private notify:(view:AutosaveView)=>void;
  private fields:DraftFields;
  private baseline:DraftFields;
  private operation:Operation|null=null;
  private restored:Recovery|null=null;
  private recoveries:Recovery[]=[];
  private status:AutosaveView['status']='saved';
  private message='';
  private storageWarning=false;
  private remote:IdeaProject|null=null;
  private comparing=false;
  private online:boolean;
  private busy=false;
  private abort:AbortController|null=null;
  private disposed=false;
  private retries=0;
  private timer:ReturnType<typeof setTimeout>|undefined;
  private debounceMs:number;
  private prefix:string;
  private backupKey:string;
  constructor(options:{project:IdeaProject;ownerId:string;transport:Transport;storage:StoragePort|null;online:boolean;notify:(view:AutosaveView)=>void;debounceMs?:number}){
    this.project=options.project;this.ownerId=options.ownerId;this.transport=options.transport;this.storage=options.storage;this.online=options.online;this.notify=options.notify;this.debounceMs=options.debounceMs??900;
    this.fields=fieldsOf(options.project);this.baseline=fieldsOf(options.project);
    this.prefix=`explainova:idea:v1:${this.ownerId}:${this.project.id}:`;
    this.backupKey=this.prefix+crypto.randomUUID();this.storageWarning=!this.storage;
    try{
      if(this.storage)for(let i=0;i<this.storage.length;i++){
        const key=this.storage.key(i);if(!key?.startsWith(this.prefix))continue;
        const raw=this.storage.getItem(key);if(!raw)continue;
        const backup=readBackup(raw,this.ownerId,this.project.id);if(!backup)continue;
        if(!backup.operation&&backup.revision===this.project.revision&&equal(backup.fields,this.baseline))continue;
        this.recoveries.push({key,raw,backup});
      }
    }catch{this.storageWarning=true;}
    this.recoveries.sort((a,b)=>b.backup.updatedAt.localeCompare(a.backup.updatedAt));
    if(this.recoveries.length)this.status='recovery';
  }
  view():AutosaveView{return {fields:{...this.fields},revision:this.project.revision,dirty:!!this.operation||!equal(this.fields,this.baseline),status:this.status,message:this.message,storageWarning:this.storageWarning,recoveries:this.recoveries,remote:this.remote,comparing:this.comparing};}
  private emit(){if(!this.disposed)this.notify(this.view());}
  private cancel(){if(this.timer)clearTimeout(this.timer);this.timer=undefined;}
  private schedule(ms=this.debounceMs){this.cancel();if(!this.disposed)this.timer=setTimeout(()=>void this.flush(),ms);}
  private removeUnchanged(source:Recovery){try{if(this.storage?.getItem(source.key)===source.raw)this.storage.removeItem(source.key);}catch{this.storageWarning=true;}}
  private persist(){
    try{
      if(!this.storage){this.storageWarning=true;return;}
      if(!this.view().dirty){this.storage.removeItem(this.backupKey);if(this.restored){this.removeUnchanged(this.restored);this.restored=null;}return;}
      const backup:Backup={schema:1,ownerId:this.ownerId,projectId:this.project.id,revision:this.project.revision,fields:this.fields,operation:this.operation,updatedAt:new Date().toISOString()};
      this.storage.setItem(this.backupKey,JSON.stringify(backup));
      // Retire a recovered source only after its replacement is durable.
      if(this.restored){this.removeUnchanged(this.restored);this.restored=null;}
    }catch{this.storageWarning=true;}
  }
  change(patch:Partial<DraftFields>){
    if(this.disposed||this.status==='recovery')return;
    this.fields={...this.fields,...patch};this.persist();
    if(this.busy||this.status==='conflict'){this.emit();return;}
    this.retries=0;this.message='';this.status=this.view().dirty?(this.online?'pending':'offline'):'saved';
    if(this.view().dirty&&this.online)this.schedule();else this.cancel();this.emit();
  }
  connectivity(online:boolean){
    if(this.disposed)return;this.online=online;
    if(this.busy||['conflict','recovery'].includes(this.status))return;
    if(this.view().dirty){this.status=online?'pending':'offline';this.message='';if(online){this.retries=0;this.schedule(0);}else this.cancel();this.emit();}
  }
  restore(key:string){
    const source=this.recoveries.find(item=>item.key===key);if(!source||this.status!=='recovery')return;
    this.restored=source;this.fields={...source.backup.fields};this.operation=source.backup.operation;
    const changed=source.backup.revision!==this.project.revision;
    // Keep the original base revision in subsequent backups until comparison.
    this.project={...this.project,revision:source.backup.revision};
    if(!this.operation&&changed){this.status='conflict';this.message='The saved draft changed since these local edits. Compare both versions before saving.';}
    else this.status=this.view().dirty?(this.online?'pending':'offline'):'saved';
    this.persist();this.emit();if(this.status==='pending')this.schedule();
  }
  discardRecoveries(){
    if(this.status!=='recovery')return;
    for(const source of this.recoveries)this.removeUnchanged(source);
    this.recoveries=[];this.status='saved';this.emit();
  }
  async flush(){
    this.cancel();if(this.disposed||this.busy||['conflict','recovery'].includes(this.status)||!this.view().dirty)return;
    if(!this.online){this.status='offline';this.persist();this.emit();return;}
    if(!this.operation){
      if(!this.fields.title.trim()){this.status='error';this.message='Add a draft title to resume autosave.';this.emit();return;}
      this.operation={key:crypto.randomUUID(),revision:this.project.revision,fields:{...this.fields}};
    }
    const operation=this.operation;this.busy=true;this.status='saving';this.message='';this.persist();this.emit();
    this.abort=new AbortController();const timeout=setTimeout(()=>this.abort?.abort(),30000);
    try{
      const response=await this.transport(`/api/v1/projects/${this.project.id}`,{method:'PATCH',signal:this.abort.signal,headers:{'Content-Type':'application/json','Idempotency-Key':operation.key},body:JSON.stringify({expectedRevision:operation.revision,...operation.fields})});
      const result=await response.json() as {data?:IdeaProject;error?:{code?:string;message?:string}};
      if(this.disposed)return;
      if(!response.ok){
        if(response.status<500){this.operation=null;this.retries=4;this.status=response.status===409?'conflict':'error';this.message=result.error?.message||'Saving paused. Your edits are still here.';this.persist();return;}
        throw Error('The draft service is unavailable.');
      }
      const saved=result.data;
      if(!saved||saved.id!==this.project.id||saved.revision!==operation.revision+1||!validRevision(saved.revision)||!validFields(saved)||!equal(fieldsOf(saved),{...operation.fields,title:operation.fields.title.trim()}))throw Error('The save could not be confirmed.');
      // A response acknowledges its snapshot, never keystrokes typed after it.
      if(equal(this.fields,operation.fields))this.fields=fieldsOf(saved);
      this.project=saved;this.baseline=fieldsOf(saved);this.operation=null;this.retries=0;this.remote=null;
      this.status=this.view().dirty?'pending':'saved';this.persist();
    }catch{
      if(this.disposed)return;
      this.retries++;this.status=this.online?'error':'offline';
      this.message=this.online?'Save not confirmed. Your edits are kept here; retrying uses the same request.':'You’re offline. Edits will sync when the connection returns.';this.persist();
    }finally{
      clearTimeout(timeout);this.abort=null;
      this.busy=false;if(!this.disposed){this.emit();if(this.status==='pending')this.schedule(0);else if(this.status==='error'&&this.operation&&this.retries<4&&this.online)this.schedule(1000*2**(this.retries-1));}
    }
  }
  async compare(){
    if(this.disposed||this.busy||this.comparing||this.status!=='conflict')return;
    this.comparing=true;this.message='';this.emit();
    this.abort=new AbortController();const timeout=setTimeout(()=>this.abort?.abort(),15000);
    try{
      const response=await this.transport(`/api/v1/projects/${this.project.id}`,{cache:'no-store',signal:this.abort.signal}),result=await response.json() as {data?:IdeaProject};
      if(this.disposed)return;
      if(!response.ok||!result.data||result.data.id!==this.project.id||!validFields(result.data)||!validRevision(result.data.revision))throw Error();
      this.remote=result.data;
    }catch{this.message='The saved version could not be loaded. Your local text is unchanged.';}
    finally{clearTimeout(timeout);this.abort=null;this.comparing=false;this.emit();}
  }
  resolve(choice:'remote'|'local'){
    if(!this.remote||this.comparing||this.status!=='conflict')return;
    this.project=this.remote;this.baseline=fieldsOf(this.remote);this.operation=null;this.remote=null;this.message='';this.retries=0;
    if(choice==='remote')this.fields={...this.baseline};
    this.status=this.view().dirty?(this.online?'pending':'offline'):'saved';this.persist();this.emit();
    if(this.status==='pending')void this.flush();
  }
  dispose(){this.disposed=true;this.cancel();this.abort?.abort();}
}
