type HistoryHost={
  addEventListener(type:'pageshow'|'popstate',listener:()=>void):void;
  removeEventListener(type:'pageshow'|'popstate',listener:()=>void):void;
  requestAnimationFrame(callback:()=>void):number;
  cancelAnimationFrame(frame:number):void;
};

// Native GET navigation can restore a cached document's edited form values.
// Sync both on the event and after the browser's form-restoration step.
export function bindSearchHistory(host:HistoryHost,readQuery:()=>string,applyQuery:(query:string)=>void){
  let frame:number|undefined;
  const sync=()=>{
    applyQuery(readQuery());
    if(frame!==undefined)host.cancelAnimationFrame(frame);
    frame=host.requestAnimationFrame(()=>{frame=undefined;applyQuery(readQuery());});
  };
  host.addEventListener('pageshow',sync);host.addEventListener('popstate',sync);
  return()=>{host.removeEventListener('pageshow',sync);host.removeEventListener('popstate',sync);if(frame!==undefined)host.cancelAnimationFrame(frame);};
}
