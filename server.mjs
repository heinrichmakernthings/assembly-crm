export default {async fetch(req,env){
const url=new URL(req.url);
if(url.pathname==='/target-planner')return new Response(planner,{headers:{'Content-Type':'text/html;charset=utf-8'}});
if(url.pathname==='/company-website')return importWebsite(req);
if(url.pathname==='/prospect-research'){
 if(req.method!=='POST'||req.headers.get('origin')!==url.origin)return Response.json({error:'Invalid request origin.'},{status:403});
 if(!env.OPENAI_API_KEY)return Response.json({error:'Set OPENAI_API_KEY in Cloudflare Worker secrets, or use Research in ChatGPT.'},{status:503});
 try{
  const {input}=await req.json();
  if(typeof input!=='string'||!input.trim()||input.length>8000)return Response.json({error:'Invalid research request.'},{status:400});
  const response=await fetch('https://api.openai.com/v1/responses',{
   method:'POST',headers:{Authorization:'Bearer '+env.OPENAI_API_KEY,'Content-Type':'application/json'},
   body:JSON.stringify({model:'gpt-5-mini',store:false,tools:[{type:'web_search'}],tool_choice:'required',max_output_tokens:4000,max_tool_calls:8,input}),
   signal:AbortSignal.timeout(90000)
  });
  if(!response.ok)return Response.json({error:'Research provider returned '+response.status+'. Check API access and billing.'},{status:502});
  return Response.json(await response.json(),{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Research did not complete. Please retry.'},{status:502})}
}
if(url.pathname==='/prospect-search'){
 const name=url.searchParams.get('name')?.trim(),city=url.searchParams.get('city')?.trim();
 if(!name||!city||name.length>150||city.length>100)return Response.json({error:'Enter a venue name and city.'},{status:400});
 try{
 const query=new URLSearchParams({name,address:city,pageSize:'15'});
 const res=await fetch('https://api.ratings.food.gov.uk/Establishments?'+query,{headers:{'x-api-version':'2',Accept:'application/json'},signal:AbortSignal.timeout(15000)});
 if(!res.ok)throw Error();
 const data=await res.json();
 return Response.json(data.establishments.map(x=>({name:x.BusinessName,address:[x.AddressLine1,x.AddressLine2,x.AddressLine3,x.AddressLine4,x.PostCode].filter(Boolean).join(', '),url:'https://ratings.food.gov.uk/business/'+encodeURIComponent(x.FHRSID)})));
 }catch{return Response.json({error:'The food business register could not be reached.'},{status:502})}
}
if(assets[url.pathname]){const [type,data]=assets[url.pathname];return new Response(Uint8Array.from(atob(data),c=>c.charCodeAt(0)),{headers:{'Content-Type':type}})}
if(url.pathname!='/api')return new Response(html,{headers:{'Content-Type':'text/html;charset=utf-8'}});
const db=env.DB;
await db.prepare('CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, data TEXT NOT NULL, rev INTEGER NOT NULL)').run();
if(req.method==='GET'){
const all=(await db.prepare("SELECT * FROM records WHERE NOT (id GLOB 'sample[0-7]' AND rev=0) ORDER BY rowid").all()).results.map(x=>({...JSON.parse(x.data),rev:x.rev}));
return Response.json({config:all.find(x=>x.id==='settings')?.config||{},rows:all.filter(x=>x.id!=='settings')},{headers:{'Cache-Control':'no-store'}})}
if(req.method!=='POST'||req.headers.get('origin')!==url.origin)return new Response('',{status:403});
const {r,goal,googleClient,dealForecast,mix}=await req.json();
if(mix){
 const {year,state,counts,previous}=mix;
 if(!Number.isInteger(year)||year<1900||year>9999||!Array.isArray(counts)||counts.length!==7||!counts.every(x=>Number.isSafeInteger(x)&&x>=0)||state?.profiles?.length!==7||JSON.stringify(state).length>20000)return new Response('',{status:400});
 const path='$.config.mix'+year;
 await db.prepare("INSERT OR IGNORE INTO records VALUES('settings',?,0)").bind(JSON.stringify({id:'settings'})).run();
 const result=await db.prepare("UPDATE records SET data=json_set(data,?,json(?),?,?) WHERE id='settings' AND json_extract(data,?) IS ?").bind(path,JSON.stringify({state,counts}), '$.config.goal'+year+'.wins',counts.reduce((a,b)=>a+b,0),path,previous?JSON.stringify(previous):null).run();
 return Response.json(true,{status:result.meta.changes?200:409});
}
if(dealForecast){
 const {companyId,dealId,values,previous,legacy,revision}=dealForecast;
 const fail=(error,status)=>Response.json({error},{status});
 if(!Array.isArray(values)||![13,14].includes(values.length)||!values.every(n=>Number.isFinite(n)&&n>=0)||typeof companyId!=='string'||companyId==='settings'||typeof dealId!=='string')return fail('Invalid forecast.',400);
 for(let attempt=0;attempt<3;attempt++){
  const stored=await db.prepare('SELECT data,rev FROM records WHERE id=?').bind(companyId).first();
  if(!stored)return fail('Company no longer exists.',404);
  const company=JSON.parse(stored.data);
  if(!company.deals&&legacy&&stored.rev===revision&&dealId===companyId){
   company.status=company.stage===4?'Client':'Prospect';
   company.contacts=company.contact||company.email?[{id:companyId,name:company.contact||company.email,email:company.email||'',role:''}]:[];
   company.tasks=company.task?[{id:companyId,text:company.task,due:company.due||'',owner:'Sam Heinrich',deal:companyId}]:[];
   company.deals=[{id:companyId,name:company.name,stage:company.stage,owner:'Sam Heinrich',close:company.wonDate||'',wonDate:company.wonDate||'',v:previous,prior:company.v}];
  }
  const deal=company.deals?.find(d=>d.id===dealId);
  if(!deal)return fail('Deal changed or was removed. Refresh to check.',409);
  const same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
  if(!same(deal.v,values)){
   if(!same(deal.v,previous))return fail('This forecast was edited elsewhere. Refresh and review before saving.',409);
   deal.v=values;
  }
  const result=await db.prepare('UPDATE records SET data=?,rev=rev+1 WHERE id=? AND rev=?').bind(JSON.stringify(company),companyId,stored.rev).run();
  if(result.meta.changes)return Response.json({...company,rev:stored.rev+1});
 }
 return fail('The record is busy. Please retry.',409);
}
if(goal||googleClient!==undefined){let key,value;if(goal){if(!Number.isInteger(goal.year)||![goal.wins,goal.income].every(n=>Number.isFinite(n)&&n>0))return new Response('',{status:400});key='goal'+goal.year;value=goal}else{if(typeof googleClient!=='string'||!/^[-a-zA-Z0-9.]+\.apps\.googleusercontent\.com$/.test(googleClient))return new Response('Invalid Google client ID',{status:400});key='googleClient';value=googleClient}
await db.prepare("INSERT OR IGNORE INTO records VALUES('settings',?,0)").bind(JSON.stringify({id:'settings'})).run();
await db.prepare("UPDATE records SET data=json_set(data,?,json(?)) WHERE id='settings'").bind('$.config.'+key,JSON.stringify(value)).run();return Response.json(true)}
if(!r||!/^([a-f0-9-]{36}|sample[0-7])$/.test(r.id)||!r.name?.trim()||!Number.isInteger(r.stage)||r.stage<0||r.stage>5||![13,14].includes(r.v?.length)||!r.v.every(n=>Number.isFinite(n)&&n>=0)||!Array.isArray(r.logs))return new Response('',{status:400});
if(r.deals!==undefined){
 const idOk=v=>typeof v==='string'&&/^([a-f0-9-]{36}|sample[0-7])$/.test(v);
 const listOk=(v,test)=>Array.isArray(v)&&v.every(e=>e&&idOk(e.id)&&test(e))&&new Set(v.map(e=>e.id)).size===v.length;
 const refOk=v=>!v||idOk(v);
 if(!listOk(r.contacts,c=>typeof c.name==='string'&&typeof c.email==='string')||
 !listOk(r.deals,d=>typeof d.name==='string'&&Number.isInteger(d.stage)&&d.stage>=0&&d.stage<=5&&refOk(d.contactId)&&(d.v===null||(Array.isArray(d.v)&&[13,14].includes(d.v.length)&&d.v.every(n=>Number.isFinite(n)&&n>=0))))||
 !listOk(r.tasks,t=>typeof t.text==='string'&&typeof t.due==='string'&&refOk(t.deal)))return new Response('',{status:400})
}
const q=await db.prepare('INSERT INTO records VALUES(?,?,1) ON CONFLICT(id) DO UPDATE SET data=excluded.data,rev=records.rev+1 WHERE records.rev=?').bind(r.id,JSON.stringify(r),r.rev).run();
return Response.json(true,{status:q.meta.changes?200:409})}}
