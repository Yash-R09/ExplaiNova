import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {localAuthHarness} from './local-form-support.mjs';
const {admin,request,browserSession}=localAuthHarness(),users=[];let passed=0;
const root='/api/v1/projects';
const check=(value,message)=>{assert.ok(value,message);passed++;};
async function call(path,jar,method='GET',body){const response=await request(path,jar,{method,...(method==='GET'?{}:{body:JSON.stringify(body),headers:{'Content-Type':'application/json','Idempotency-Key':randomUUID()}})});check(response.headers.get('cache-control')?.includes('no-store'),'search/private API not cached');return {response,json:await response.json()};}
const query=q=>'q='+encodeURIComponent(q);
try{
 for(let n=0;n<2;n++){const email=`search-qa-${randomUUID()}@example.test`,password=randomUUID()+'aA1!';const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(error);const user={id:data.user.id,jar:null};users.push(user);user.jar=await browserSession(email,password);}
 const [alice,bob]=users,orbits=[];
 check((await call(root+'?q=orbit',new Map())).response.status===401,'anonymous search denied');
 for(let i=0;i<22;i++)orbits.push((await call(root,alice.jar,'POST',{title:`Orbit lesson ${String(i).padStart(2,'0')}`})).json.data);
 // Newer unrelated records ensure filtering occurs before the LIMIT.
 for(let i=0;i<22;i++)await call(root,alice.jar,'POST',{title:`Ocean report ${i}`,brief:'Orbit appears only in the body.'});
 const literal=(await call(root,alice.jar,'POST',{title:'100% real_under\\score + lesson'})).json.data;
 await call(root,alice.jar,'POST',{title:'Écho 🌙'});await call(root,alice.jar,'POST',{title:"SQL-looking ' OR 1=1 --"});
 const foreign=(await call(root,bob.jar,'POST',{title:'Orbit private from Bob'})).json.data;
 const first=await call(root+'?q=OrBiT&limit=7',alice.jar);
 check(first.json.data.length===7&&first.json.meta.hasMore&&first.json.meta.query==='OrBiT','case-insensitive search finds old matches before pagination');
 const ids=[...first.json.data.map(p=>p.id)];let cursor=first.json.meta.nextCursor;
 while(cursor){const next=await call(root+'?q=OrBiT&limit=7&cursor='+encodeURIComponent(cursor),alice.jar);check(next.json.data.every(p=>p.title.toLowerCase().includes('orbit')),'every page matches search');ids.push(...next.json.data.map(p=>p.id));cursor=next.json.meta.nextCursor;}
 check(ids.length===22&&new Set(ids).size===22&&!ids.includes(foreign.id),'pages cover all owned matches without foreign/duplicate rows');
 for(const q of ['OrBiT','orbit','  orbit  '])check((await call(root+'?limit=50&'+query(q),alice.jar)).json.data.length===22,'trim/case title matching consistent');
 for(const q of ['%','_','\\','+']){const found=await call(root+'?'+query(q),alice.jar);check(found.json.data.length===1&&found.json.data[0].id===literal.id,'pattern characters are literal');}
 check((await call(root+'?'+query("' OR 1=1 --"),alice.jar)).json.data.length===1,'SQL-looking query only matches its literal title');
 check((await call(root+'?'+query('éCHO'),alice.jar)).json.data.length===1,'Unicode case title match');
 check((await call(root+'?'+query('🌙'),alice.jar)).json.data.length===1,'emoji title match');
 check((await call(root+'?'+query('only in the body'),alice.jar)).json.data.length===0,'body is not searched');
 check((await call(root+'?'+query('private from Bob'),alice.jar)).json.data.length===0,'foreign matching title concealed');
 check((await call(root+'?q=orbit',bob.jar)).json.data.length===1,'second user sees own results only');
 check((await call(root+'?limit=50&q=%20%20',alice.jar)).json.data.length===47,'blank query clears filter');
 for(const suffix of ['q=a&q=b',query('x'.repeat(141)),query('bad\nquery'),'q=orbit&owner_id='+bob.id,'q=moon&cursor='+first.json.meta.nextCursor,'q=orbit&cursor='+first.json.meta.nextCursor,'cursor='+first.json.meta.nextCursor,'view=trash&q=OrBiT&cursor='+first.json.meta.nextCursor])check((await call(root+'?'+suffix,alice.jar)).response.status===400,'invalid or changed search/cursor rejected');
 const page=await request('/projects?q=Orbit',alice.jar),html=await page.text();
 check(page.status===200&&(html.match(/<article\b/g)||[]).length===20&&html.includes('name="q"')&&html.includes('value="Orbit"'),'SSR search form and first result page render');
 const older=(html.match(/href="([^"]+)"/g)||[]).map(s=>s.slice(6,-1).replaceAll('&amp;','&')).find(h=>h.startsWith('/projects?')&&new URL(h,'http://127.0.0.1').searchParams.has('cursor'));
 check(!!older&&new URL(older,'http://127.0.0.1').searchParams.get('q')==='Orbit','Older drafts link retains query');
 const olderHtml=await (await request(older,alice.jar)).text();check((olderHtml.match(/<article\b/g)||[]).length===2,'SSR later page contains remaining matches');
 const emptyHtml=await (await request('/projects?q=no-such-title',alice.jar)).text();check(emptyHtml.includes('No matching drafts.')&&!emptyHtml.includes('Create your first draft'),'empty search does not claim empty library');
 const invalidPage=await (await request('/projects?q=a&q=b',alice.jar)).text();check(invalidPage.includes('Let’s open your library again.'),'invalid UI query has recovery link');
 await call(`${root}/${orbits[0].id}`,alice.jar,'PATCH',{expectedRevision:1,title:'Moon lesson'});
 check((await call(root+'?limit=50&q=orbit',alice.jar)).json.data.length===21,'rename removes previous match');
 check((await call(root+'?q=moon',alice.jar)).json.data[0].id===orbits[0].id,'rename adds new match');
 for(const p of orbits.slice(1))await call(`${root}/${p.id}`,alice.jar,'DELETE',{expectedRevision:1});
 check((await call(root+'?q=orbit',alice.jar)).json.data.length===0,'active search excludes matching Trash');
 const t1=await call(root+'?view=trash&q=orbit&limit=15',alice.jar),t2=await call(root+'?view=trash&q=orbit&limit=15&cursor='+t1.json.meta.nextCursor,alice.jar);
 check(t1.json.data.length===15&&t2.json.data.length===6&&new Set([...t1.json.data,...t2.json.data].map(p=>p.id)).size===21,'Trash search paging covers owned matches');
 check(t1.json.data.every(p=>!('brief' in p)&&!('referenceText' in p)),'Trash search returns summaries only');
 check((await call(root+'?view=trash&q=orbit',bob.jar)).json.data.length===0,'foreign Trash search concealed');
 const trashHtml=await (await request('/projects/trash?q=orbit',alice.jar)).text();check((trashHtml.match(/<article\b/g)||[]).length===20&&trashHtml.includes('name="q"'),'Trash UI search returns first page');
 const emptyTrash=await (await request('/projects/trash?q=no-such-title',alice.jar)).text();check(emptyTrash.includes('No matching drafts in Trash.'),'Trash search has distinct no-match state');
 await call(`${root}/${orbits[1].id}/restore`,alice.jar,'POST',{expectedRevision:2});
 check((await call(root+'?q=orbit',alice.jar)).json.data[0].id===orbits[1].id,'restoration adds active search match');
 check((await call(root+'?view=trash&limit=50&q=orbit',alice.jar)).json.data.length===20,'restoration removes Trash search match');
 assert.ifError((await admin.from('profiles').update({deletion_status:'pending'}).eq('owner_id',alice.id)).error);
 check((await call(root+'?q=orbit',alice.jar)).response.status===403,'inactive active search denied');check((await call(root+'?view=trash&q=orbit',alice.jar)).response.status===403,'inactive Trash search denied');
 console.log(`Passed ${passed} local title-search assertions.`);
}finally{for(const user of users){assert.ifError((await admin.from('projects').delete().eq('owner_id',user.id)).error);assert.ifError((await admin.from('profiles').delete().eq('owner_id',user.id)).error);assert.ifError((await admin.auth.admin.deleteUser(user.id)).error);}}
